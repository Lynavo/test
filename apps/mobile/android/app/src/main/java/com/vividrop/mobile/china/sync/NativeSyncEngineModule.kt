package com.vividrop.mobile.china.sync

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject

class NativeSyncEngineModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val discoveryLock = Any()
  private var nsdManager: NsdManager? = null
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null
  private var discoveryGeneration = 0L
  private val discoveredCandidates = mutableMapOf<String, DiscoveredServiceCandidate>()
  private val reachableCandidates = mutableMapOf<String, DiscoveredServiceCandidate>()
  private val pendingResolveKeys = mutableSetOf<String>()
  private val diagnosticsLogLock = Any()
  private val diagnosticsLogLines = mutableListOf<String>()
  private var pendingPhotoPermissionPromise: Promise? = null

  override fun getName(): String = MODULE_NAME

  override fun invalidate() {
    stopDiscoveryInternal(emitUpdate = false)
    super.invalidate()
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // Required for NativeEventEmitter compatibility.
  }

  @ReactMethod
  fun requestPhotoPermission(promise: Promise) {
    val currentState = currentPhotoPermissionState()
    recordNativeLog("PhotoPermission", "request started currentState=$currentState")
    if (currentState == "granted" || currentState == "limited") {
      recordNativeLog("PhotoPermission", "request resolved without prompt state=$currentState")
      promise.resolve(currentState)
      return
    }

    val activity = getCurrentActivity()
    if (activity !is PermissionAwareActivity) {
      recordNativeLog("PhotoPermission", "request unavailable activity=${activity?.javaClass?.simpleName ?: "null"}", Log.WARN)
      emitError(
        code = "ANDROID_PHOTO_PERMISSION_UNAVAILABLE",
        message = "Android 当前 Activity 不支持相簿权限请求。",
      )
      promise.resolve(currentState)
      return
    }

    if (pendingPhotoPermissionPromise != null) {
      promise.reject(
        "ANDROID_PHOTO_PERMISSION_REQUEST_IN_PROGRESS",
        "Photo permission request is already in progress",
      )
      return
    }

    pendingPhotoPermissionPromise = promise
    try {
      activity.requestPermissions(
        photoPermissionsForRequest(),
        PHOTO_PERMISSION_REQUEST_CODE,
      ) { requestCode, _, _ ->
        if (requestCode != PHOTO_PERMISSION_REQUEST_CODE) {
          return@requestPermissions false
        }

        val pendingPromise = pendingPhotoPermissionPromise
        pendingPhotoPermissionPromise = null
        val nextState = currentPhotoPermissionState()
        recordNativeLog("PhotoPermission", "request completed state=$nextState")
        pendingPromise?.resolve(nextState)
        true
      }
    } catch (error: Throwable) {
      pendingPhotoPermissionPromise = null
      recordNativeLog("PhotoPermission", "request failed: ${error.message ?: error.javaClass.simpleName}", Log.ERROR)
      promise.reject(
        "ANDROID_PHOTO_PERMISSION_REQUEST_FAILED",
        error.message ?: "Failed to request Android photo permission",
        error,
      )
    }
  }

  @ReactMethod
  fun startDiscovery(promise: Promise) {
    recordNativeLog("Discovery", "startDiscovery requested")
    val manager = reactApplicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager
    if (manager == null) {
      recordNativeLog("Discovery", "startDiscovery unavailable: NsdManager missing", Log.WARN)
      emitDiscoveredDevicesChanged()
      emitError(
        code = "ANDROID_DISCOVERY_UNAVAILABLE",
        message = "Android 系统未提供局域网发现服务，无法扫描电脑端设备。",
      )
      promise.resolve(null)
      return
    }

    val listener: NsdManager.DiscoveryListener
    synchronized(discoveryLock) {
      stopDiscoveryLocked()
      nsdManager = manager
      acquireMulticastLockLocked()
      discoveryGeneration += 1
      listener = createDiscoveryListener(
        manager = manager,
        generation = discoveryGeneration,
      )
      discoveryListener = listener
    }

    emitDiscoveredDevicesChanged()
    try {
      manager.discoverServices(BONJOUR_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (error: Throwable) {
      synchronized(discoveryLock) {
        stopDiscoveryLocked()
      }
      recordNativeLog("Discovery", "startDiscovery failed: ${error.message ?: error.javaClass.simpleName}", Log.ERROR)
      emitError(
        code = "ANDROID_DISCOVERY_START_FAILED",
        message = "启动 Android 局域网发现失败：${error.message ?: "unknown error"}",
      )
    }
    promise.resolve(null)
  }

  @ReactMethod
  fun stopDiscovery(promise: Promise) {
    recordNativeLog("Discovery", "stopDiscovery requested")
    stopDiscoveryInternal(emitUpdate = true)
    promise.resolve(null)
  }

  @ReactMethod
  fun pairDevice(params: ReadableMap, promise: Promise) {
    runAsync(promise) {
      val host = params.getString("host")?.trim().orEmpty()
      val port = if (params.hasKey("port")) params.getInt("port") else DEFAULT_PROTOCOL_PORT
      val fallbackDeviceId = params.getString("deviceId")?.trim().orEmpty()
      val connectionCode = params.getString("connectionCode")?.trim().orEmpty()

      if (host.isBlank()) {
        throw IllegalArgumentException("Missing host for pairing")
      }
      if (connectionCode.length != CONNECTION_CODE_LENGTH) {
        throw IllegalArgumentException("Connection code must be 6 digits")
      }
      recordNativeLog(
        "Pairing",
        "pairDevice requested deviceId=${fallbackDeviceId.ifBlank { "<unknown>" }} host=$host port=$port codeProvided=${connectionCode.isNotBlank()}",
      )

      val helloPayload = JSONObject().apply {
        put("clientId", getOrCreateClientId())
        put("clientName", getClientDisplayNameValue())
        put("clientPlatform", "android")
        put("appVersion", getVersionName())
        put("appState", "active")
      }

      val resolvedBinding = performPairing(
        host = host,
        port = port,
        fallbackDeviceId = fallbackDeviceId,
        connectionCode = connectionCode,
        helloPayload = helloPayload,
      )

      saveBinding(resolvedBinding)
      recordNativeLog(
        "Pairing",
        "pairDevice successful deviceId=${resolvedBinding.deviceId} host=${resolvedBinding.host} shareEnabled=${resolvedBinding.shareEnabled}",
        Log.INFO,
      )
      emitBindingStateChanged(resolvedBinding)
      emitIdleSyncState(resolvedBinding)
      emitQueueUpdated(Arguments.createArray())
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun disconnectAndUnbind(promise: Promise) {
    recordNativeLog("Pairing", "disconnectAndUnbind requested")
    clearBinding()
    emitBindingStateCleared()
    emitIdleSyncState(null)
    emitQueueUpdated(Arguments.createArray())
    promise.resolve(null)
  }

  @ReactMethod
  fun getBindingState(promise: Promise) {
    promise.resolve(loadBinding()?.toWritableMap())
  }

  @ReactMethod
  fun getSyncOverview(promise: Promise) {
    promise.resolve(buildIdleSyncSummary(loadBinding()))
  }

  @ReactMethod
  fun getReadOnlyQueue(promise: Promise) {
    promise.resolve(Arguments.createArray())
  }

  @ReactMethod
  fun getHistoryDays(cursor: String?, promise: Promise) {
    val result = Arguments.createMap().apply {
      putArray("items", Arguments.createArray())
      putNull("nextCursor")
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun getAppInfo(promise: Promise) {
    val label = reactApplicationContext.applicationInfo.loadLabel(
      reactApplicationContext.packageManager,
    ).toString()
    val result = Arguments.createMap().apply {
      putString("appName", label)
      putString("version", getVersionName())
      putString("build", getVersionCode())
      putString("platform", "android")
      putString("supportLevel", "shell")
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun exportDiagnostics(promise: Promise) {
    runAsync(promise) {
      val engineLogSnapshot = diagnosticsLogSnapshot()
      dumpDiagnosticsLogSnapshotToConsole(engineLogSnapshot)
      val archive = File(
        reactApplicationContext.cacheDir,
        "syncflow-android-diagnostics-${System.currentTimeMillis()}.json",
      )
      val payload = JSONObject().apply {
        put("generatedAt", isoNow())
        put("platform", "android")
        put("supportLevel", "shell")
        put("clientId", getOrCreateClientId())
        put("clientDisplayName", getClientDisplayNameValue())
        put(
          "appInfo",
          JSONObject().apply {
            put("version", getVersionName())
            put("build", getVersionCode())
          },
        )
        put("binding", loadBinding()?.toJson() ?: JSONObject.NULL)
        put("logs", JSONArray(engineLogSnapshot))
      }
      archive.writeText(payload.toString(2), StandardCharsets.UTF_8)
      recordNativeLog("Diagnostics", "exported android diagnostics file ${archive.name} bytes=${archive.length()}")
      promise.resolve(archive.absolutePath)
    }
  }

  @ReactMethod
  fun uploadDiagnosticsArchive(params: ReadableMap, promise: Promise) {
    thread(name = "NativeSyncEngineDiagnosticsUpload", isDaemon = true) {
      try {
        val uploadUrl = params.getStringOrNull("url")?.trim().orEmpty()
        val archivePath = params.getStringOrNull("archivePath")?.trim().orEmpty()
        val note = params.getStringOrNull("note")?.trim().orEmpty()
        val headers = if (params.hasKey("headers") && !params.isNull("headers")) {
          params.getMap("headers")
        } else {
          null
        }

        val result = performDiagnosticsArchiveUpload(
          uploadUrl = uploadUrl,
          archivePath = archivePath,
          note = note,
          headers = readableMapToStringMap(headers),
        )
        promise.resolve(result)
      } catch (error: NativeBridgeException) {
        diagnosticsUploadLog("failed code=${error.nativeCode} message=${error.message.orEmpty()}")
        promise.reject(error.nativeCode, error.message, error)
      } catch (error: Throwable) {
        diagnosticsUploadLog("failed code=NETWORK_ERROR message=${error.message.orEmpty()}")
        promise.reject("NETWORK_ERROR", error.message ?: "Diagnostics upload failed", error)
      }
    }
  }

  @ReactMethod
  fun recordDiagnosticsLog(category: String, message: String) {
    recordNativeLog(category.trim().ifBlank { "JS" }, message)
  }

  private fun recordNativeLog(
    category: String,
    message: String,
    priority: Int = Log.DEBUG,
  ) {
    val line = buildDiagnosticsLogLine(
      timestampIso = isoNow(),
      category = category,
      message = message,
    )
    synchronized(diagnosticsLogLock) {
      diagnosticsLogLines.add(line)
      if (diagnosticsLogLines.size > MAX_DIAGNOSTICS_LOG_LINES) {
        val retained = retainRecentLogLines(diagnosticsLogLines, MAX_DIAGNOSTICS_LOG_LINES)
        diagnosticsLogLines.clear()
        diagnosticsLogLines.addAll(retained)
      }
    }
    val consoleMessage = buildConsoleLogMessage(
      localTimestamp = localLogTimestamp(),
      category = category,
      message = message,
    )
    when (priority) {
      Log.ERROR -> Log.e(MODULE_NAME, consoleMessage)
      Log.WARN -> Log.w(MODULE_NAME, consoleMessage)
      Log.INFO -> Log.i(MODULE_NAME, consoleMessage)
      else -> Log.d(MODULE_NAME, consoleMessage)
    }
  }

  @ReactMethod
  fun getClientDisplayName(promise: Promise) {
    promise.resolve(getClientDisplayNameValue())
  }

  @ReactMethod
  fun getClientId(promise: Promise) {
    promise.resolve(getOrCreateClientId())
  }

  @ReactMethod
  fun getKnownDeviceIds(promise: Promise) {
    val result = Arguments.createArray()
    for (deviceId in getKnownDeviceIdsValue()) {
      result.pushString(deviceId)
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun setClientDisplayName(name: String, promise: Promise) {
    val trimmed = name.trim()
    if (trimmed.isBlank()) {
      promise.resolve(null)
      return
    }

    prefs.edit().putString(PREF_CLIENT_DISPLAY_NAME, trimmed).apply()
    promise.resolve(null)
  }

  @ReactMethod
  fun triggerSync(promise: Promise) {
    recordNativeLog("Sync", "triggerSync requested")
    emitError(
      code = "ANDROID_SYNC_NOT_IMPLEMENTED",
      message = "Android 端原生同步引擎尚未接入，当前版本仅提供基础壳层与配对入口。",
    )
    promise.resolve(null)
  }

  @ReactMethod
  fun renameBoundDeviceAlias(alias: String, promise: Promise) {
    val binding = loadBinding()
    if (binding == null) {
      promise.resolve(null)
      return
    }

    val updated = binding.copy(deviceAlias = alias.trim().ifBlank { binding.deviceName })
    saveBinding(updated)
    emitBindingStateChanged(updated)
    promise.resolve(null)
  }

  @ReactMethod
  fun resetAllStatus(promise: Promise) {
    recordNativeLog("SyncEngine", "resetAllStatus requested")
    emitIdleSyncState(loadBinding())
    emitQueueUpdated(Arguments.createArray())
    promise.resolve(null)
  }

  // ---------------------------------------------------------------------------
  // Account Identity Reset (Phase 1 / 2 / 3)
  //
  // Android shell has no upload queue / history DB, so "wipe" reduces to
  // clearing the sync identity fields in SharedPreferences. We mirror the
  // iOS 2-phase sentinel so a crash mid-wipe is recoverable on next launch
  // (see MainApplication.onCreate).
  // ---------------------------------------------------------------------------

  @ReactMethod
  fun wipeSyncIdentity(promise: Promise) {
    try {
      performWipeSyncIdentity(prefs)
      emitBindingStateCleared()
      emitQueueUpdated(Arguments.createArray())
      emitIdleSyncState(null)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("WIPE_SYNC_IDENTITY_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun getOwnerUserId(promise: Promise) {
    // Stored as String so backend ids above 2^53 round-trip losslessly
    // across the RN bridge (a Double/Long hop would truncate the low bits).
    // The JS bootstrap compares against `String(profile.id)`.
    val stored = prefs.getString(PREF_OWNER_USER_ID, null)
    promise.resolve(stored)
  }

  @ReactMethod
  fun setOwnerUserId(userId: String, promise: Promise) {
    // String-typed arg avoids the Double demotion that would otherwise
    // silently clip ids above 2^53.
    //
    // `commit()` not `apply()` — this write is the Phase-2 owner marker
    // and MUST be durable before the promise resolves. A process kill
    // between apply()'s in-memory commit and the eventual async flush
    // would leave `storedOwnerId` null on next launch, causing the
    // owner-mismatch guard in bootstrapAuthedSession to mis-classify
    // user B as a fresh install and skip the wipe — defeating the
    // entire Phase 2 defense. We already use commit() for the
    // install_marker and wipe_in_progress sentinels for the same
    // reason (see runInstallSentinel + performWipeSyncIdentity).
    //
    // Reject the JS promise if `commit()` returns `false` (disk full,
    // SharedPreferences corruption, etc.). Silently resolving on a
    // failed write would leave us one cold start away from a Phase-2
    // bypass — the marker is the only signal the owner-mismatch guard
    // has.
    val flushed = prefs.edit().putString(PREF_OWNER_USER_ID, userId).commit()
    if (flushed) {
      promise.resolve(null)
    } else {
      android.util.Log.w(
        "NativeSyncEngineModule",
        "setOwnerUserId: SharedPreferences.commit() returned false for $PREF_OWNER_USER_ID",
      )
      promise.reject(
        "SET_OWNER_USER_ID_FLUSH_FAILED",
        "SharedPreferences.commit() returned false — owner marker not durably written",
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Stub methods — Android native sync engine is not yet implemented.
  // These stubs return safe defaults so JS screens don't crash when calling
  // bridge methods that only have real implementations on iOS.
  // ---------------------------------------------------------------------------

  @ReactMethod
  fun browseAlbum(params: ReadableMap, promise: Promise) {
    promise.resolve(Arguments.createArray())
  }

  @ReactMethod
  fun getAlbumStats(promise: Promise) {
    promise.resolve(Arguments.createMap().apply {
      putInt("totalCount", 0)
      putInt("transferredCount", 0)
      putInt("queuedCount", 0)
      putInt("pendingCount", 0)
    })
  }

  @ReactMethod
  fun getAlbumCollections(mediaFilter: String, promise: Promise) {
    promise.resolve(Arguments.createArray())
  }

  @ReactMethod
  fun getAssetPreviewSource(assetLocalId: String, promise: Promise) {
    promise.resolve(Arguments.createMap().apply {
      putString("uri", "")
      putString("mediaType", "image")
      putString("error", "not_found")
    })
  }

  @ReactMethod
  fun submitManualUpload(params: ReadableMap, promise: Promise) {
    recordNativeLog("ManualUpload", "submit requested")
    promise.reject("ANDROID_NOT_IMPLEMENTED", "手动上传功能暂未在 Android 端实现")
  }

  @ReactMethod
  fun cancelManualBatch(batchId: String, promise: Promise) {
    recordNativeLog("ManualUpload", "cancel batch requested batchId=$batchId")
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelAllManualUploads(promise: Promise) {
    recordNativeLog("ManualUpload", "cancel all requested")
    emitQueueUpdated(Arguments.createArray())
    emitIdleSyncState(loadBinding())
    promise.resolve(null)
  }

  @ReactMethod
  fun pauseAutoUpload(promise: Promise) {
    recordNativeLog("AutoUpload", "pause requested")
    persistAutoUploadInterruptedState()
    emitSyncState(loadBinding(), "paused_auto_upload")
    promise.resolve(null)
  }

  @ReactMethod
  fun disableAutoUpload(promise: Promise) {
    recordNativeLog("AutoUpload", "disable requested")
    persistAutoUploadDisabledState()
    emitIdleSyncState(loadBinding())
    promise.resolve(null)
  }

  @ReactMethod
  fun resumeAutoUpload(promise: Promise) {
    recordNativeLog("AutoUpload", "resume requested")
    persistAutoUploadActiveState()
    emitIdleSyncState(loadBinding())
    promise.resolve(null)
  }

  @ReactMethod
  fun getAutoUploadConfig(promise: Promise) {
    promise.resolve(buildAutoUploadConfigMap())
  }

  @ReactMethod
  fun saveAutoUploadConfig(params: ReadableMap, promise: Promise) {
    val currentConfig = loadAutoUploadConfig()
    val enabled = if (params.hasKey("enabled") && !params.isNull("enabled")) {
      params.getBoolean("enabled")
    } else {
      currentConfig.enabled
    }
    val timeRangeMode = params.getStringOrNull("timeRangeMode")
      ?.takeIf { it.isNotBlank() }
      ?: currentConfig.timeRangeMode
    val customTimeFrom = params.getStringOrNull("customTimeFrom")
      ?.takeIf { it.isNotBlank() }
      ?: currentConfig.customTimeFrom
    val state = when {
      !enabled -> "disabled"
      currentConfig.state == "disabled" -> "active"
      else -> currentConfig.state
    }

    saveAutoUploadConfig(
      AutoUploadConfig(
        enabled = enabled,
        state = state,
        timeRangeMode = timeRangeMode,
        customTimeFrom = customTimeFrom,
      ),
    )
    recordNativeLog(
      "AutoUpload",
      "config saved enabled=$enabled state=$state timeRangeMode=$timeRangeMode customTimeFrom=${customTimeFrom ?: "<none>"}",
    )
    promise.resolve(null)
  }

  @ReactMethod
  fun browseSharedFiles(path: String, promise: Promise) {
    promise.resolve(Arguments.createMap().apply {
      putString("path", path)
      putArray("files", Arguments.createArray())
      putInt("totalCount", 0)
    })
  }

  @ReactMethod
  fun downloadSharedFile(path: String, promise: Promise) {
    promise.reject("ANDROID_NOT_IMPLEMENTED", "共享文件下载功能暂未在 Android 端实现")
  }

  @ReactMethod
  fun getSharedFileStreamUrl(path: String, promise: Promise) {
    promise.reject("ANDROID_NOT_IMPLEMENTED", "共享文件流功能暂未在 Android 端实现")
  }

  @ReactMethod
  fun shareFile(localPath: String, promise: Promise) {
    promise.reject("ANDROID_NOT_IMPLEMENTED", "文件分享功能暂未在 Android 端实现")
  }

  @ReactMethod
  fun getPhotoAuthorizationStatus(promise: Promise) {
    // Reuse the same permission check as requestPhotoPermission so both
    // bridge methods agree on what "authorized" means.
    val state = currentPhotoPermissionState()
    promise.resolve(
      when {
        state == "granted" -> "authorized"
        state == "limited" -> "limited"
        else -> "denied"
      },
    )
  }

  @ReactMethod
  fun presentLimitedPhotoPicker(promise: Promise) {
    // No limited-access picker concept on Android; resolve as no-op.
    promise.resolve(null)
  }

  private fun runAsync(promise: Promise, block: () -> Unit) {
    thread(name = "NativeSyncEngine", isDaemon = true) {
      try {
        block()
      } catch (error: Throwable) {
        recordNativeLog("Bridge", "async method failed: ${error.message ?: error.javaClass.simpleName}", Log.ERROR)
        promise.reject("NATIVE_SYNC_ENGINE_ERROR", error.message, error)
      }
    }
  }

  private fun performPairing(
    host: String,
    port: Int,
    fallbackDeviceId: String,
    connectionCode: String,
    helloPayload: JSONObject,
  ): StoredBinding {
    Socket().use { socket ->
      recordNativeLog("Pairing", "TCP connecting host=$host port=$port")
      socket.connect(InetSocketAddress(host, port), SOCKET_TIMEOUT_MS)
      socket.soTimeout = SOCKET_TIMEOUT_MS
      recordNativeLog("Pairing", "TCP connected host=$host port=$port")

      val input = DataInputStream(socket.getInputStream())
      val output = DataOutputStream(socket.getOutputStream())

      writeJsonFrame(output, TYPE_HELLO_REQ, helloPayload)
      val helloResponse = readJsonFrame(input, TYPE_HELLO_RES)
      recordNativeLog(
        "Pairing",
        "HELLO_RES serverId=${helloResponse.optString("serverId")} authRequired=${helloResponse.optBoolean("authRequired", true)}",
      )

      val serverCapabilities = helloResponse.optJSONObject("serverCapabilities")
      val shareName = serverCapabilities?.optString("shareName")
        ?.takeIf { it.isNotBlank() }
      val serverId = helloResponse.optString("serverId")
        .takeIf { it.isNotBlank() }
        ?: fallbackDeviceId
      val serverName = helloResponse.optString("serverName")
        .takeIf { it.isNotBlank() }
        ?: host

      if (!helloResponse.optBoolean("authRequired", true)) {
        recordNativeLog("Pairing", "HELLO_RES accepted without auth", Log.INFO)
        return StoredBinding(
          deviceId = serverId,
          deviceName = serverName,
          deviceAlias = serverName,
          host = host,
          port = port,
          pairingId = "",
          shareEnabled = shareName != null,
          shareName = shareName,
          lastBoundAt = isoNow(),
          connectionState = "bound",
        )
      }

      val pairPayload = JSONObject().apply {
        put("clientId", getOrCreateClientId())
        put("clientName", getClientDisplayNameValue())
        put("connectionCode", connectionCode)
      }
      writeJsonFrame(output, TYPE_PAIR_REQ, pairPayload)
      val pairResponse = readJsonFrame(input, TYPE_PAIR_RES)

      if (!pairResponse.optBoolean("ok", false)) {
        recordNativeLog("Pairing", "PAIR_RES rejected error=${pairResponse.optString("error")}", Log.WARN)
        throw IllegalStateException("Pairing rejected")
      }
      recordNativeLog("Pairing", "PAIR_RES ok pairingId=${pairResponse.optString("pairingId")}", Log.INFO)

      val serverInfo = pairResponse.optJSONObject("serverInfo")
      return StoredBinding(
        deviceId = serverInfo?.optString("serverId")
          ?.takeIf { it.isNotBlank() }
          ?: serverId,
        deviceName = serverInfo?.optString("serverName")
          ?.takeIf { it.isNotBlank() }
          ?: serverName,
        deviceAlias = serverInfo?.optString("serverName")
          ?.takeIf { it.isNotBlank() }
          ?: serverName,
        host = host,
        port = port,
        pairingId = pairResponse.optString("pairingId"),
        shareEnabled = serverInfo?.optString("shareName")?.isNotBlank() == true,
        shareName = serverInfo?.optString("shareName")?.takeIf { it.isNotBlank() },
        lastBoundAt = isoNow(),
        connectionState = "bound",
      )
    }
  }

  private fun writeJsonFrame(
    output: DataOutputStream,
    type: Int,
    payload: JSONObject,
  ) {
    val body = payload.toString().toByteArray(StandardCharsets.UTF_8)
    val header = ByteBuffer.allocate(HEADER_SIZE)
      .order(ByteOrder.BIG_ENDIAN)
      .put(MAGIC_BYTES)
      .putShort(PROTOCOL_VERSION.toShort())
      .putShort(type.toShort())
      .putInt(body.size)
      .array()
    output.write(header)
    output.write(body)
    output.flush()
  }

  private fun readJsonFrame(input: DataInputStream, expectedType: Int): JSONObject {
    val headerBytes = ByteArray(HEADER_SIZE)
    input.readFully(headerBytes)
    val header = ByteBuffer.wrap(headerBytes).order(ByteOrder.BIG_ENDIAN)

    val magic = ByteArray(MAGIC_BYTES.size)
    header.get(magic)
    if (!magic.contentEquals(MAGIC_BYTES)) {
      throw IllegalStateException("Invalid LMUP magic")
    }

    val version = header.short.toInt()
    if (version != PROTOCOL_VERSION) {
      throw IllegalStateException("Unsupported LMUP version: $version")
    }

    val actualType = header.short.toInt()
    if (actualType != expectedType) {
      throw IllegalStateException("Unexpected frame type: $actualType")
    }

    val bodyLength = header.int
    if (bodyLength < 0 || bodyLength > MAX_BODY_LENGTH) {
      throw IllegalStateException("Invalid frame size: $bodyLength")
    }

    if (bodyLength == 0) {
      return JSONObject()
    }

    val body = ByteArray(bodyLength)
    input.readFully(body)
    return JSONObject(String(body, StandardCharsets.UTF_8))
  }

  private fun photoPermissionsForRequest(): Array<String> {
    return when {
      Build.VERSION.SDK_INT >= ANDROID_14_API -> arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        PERMISSION_READ_MEDIA_VISUAL_USER_SELECTED,
      )
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
      )
      else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    }
  }

  private fun currentPhotoPermissionState(): String {
    return if (Build.VERSION.SDK_INT >= ANDROID_14_API) {
      val hasImages = reactApplicationContext.checkSelfPermission(
        Manifest.permission.READ_MEDIA_IMAGES,
      ) == PackageManager.PERMISSION_GRANTED
      val hasVideo = reactApplicationContext.checkSelfPermission(
        Manifest.permission.READ_MEDIA_VIDEO,
      ) == PackageManager.PERMISSION_GRANTED
      val hasSelected = reactApplicationContext.checkSelfPermission(
        PERMISSION_READ_MEDIA_VISUAL_USER_SELECTED,
      ) == PackageManager.PERMISSION_GRANTED
      when {
        hasImages && hasVideo -> "granted"
        hasSelected || hasImages || hasVideo -> "limited"
        else -> "denied"
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val hasImages = reactApplicationContext.checkSelfPermission(
        Manifest.permission.READ_MEDIA_IMAGES,
      ) == PackageManager.PERMISSION_GRANTED
      val hasVideo = reactApplicationContext.checkSelfPermission(
        Manifest.permission.READ_MEDIA_VIDEO,
      ) == PackageManager.PERMISSION_GRANTED
      when {
        hasImages && hasVideo -> "granted"
        hasImages || hasVideo -> "limited"
        else -> "denied"
      }
    } else {
      val granted = reactApplicationContext.checkSelfPermission(
        Manifest.permission.READ_EXTERNAL_STORAGE,
      ) == PackageManager.PERMISSION_GRANTED
      if (granted) "granted" else "denied"
    }
  }

  private fun getOrCreateClientId(): String {
    val existing = prefs.getString(PREF_CLIENT_ID, null)
    if (!existing.isNullOrBlank()) {
      return existing
    }

    val generated = UUID.randomUUID().toString()
    prefs.edit().putString(PREF_CLIENT_ID, generated).apply()
    return generated
  }

  private fun getClientDisplayNameValue(): String {
    val stored = prefs.getString(PREF_CLIENT_DISPLAY_NAME, null)
    if (!stored.isNullOrBlank()) {
      return stored
    }

    return "Android ${Build.MODEL}".trim()
  }

  private fun getVersionName(): String {
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.packageManager.getPackageInfo(
        reactApplicationContext.packageName,
        PackageManager.PackageInfoFlags.of(0),
      )
    } else {
      @Suppress("DEPRECATION")
      reactApplicationContext.packageManager.getPackageInfo(
        reactApplicationContext.packageName,
        0,
      )
    }

    return packageInfo.versionName ?: "0.1.0"
  }

  private fun getVersionCode(): String {
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.packageManager.getPackageInfo(
        reactApplicationContext.packageName,
        PackageManager.PackageInfoFlags.of(0),
      )
    } else {
      @Suppress("DEPRECATION")
      reactApplicationContext.packageManager.getPackageInfo(
        reactApplicationContext.packageName,
        0,
      )
    }

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.longVersionCode.toString()
    } else {
      @Suppress("DEPRECATION")
      packageInfo.versionCode.toString()
    }
  }

  private fun emitDiscoveredDevicesChanged() {
    emitDiscoveredDevicesChanged(Arguments.createArray())
  }

  private fun emitDiscoveredDevicesChanged(devices: WritableArray) {
    emitEvent("onDiscoveredDevicesChanged", devices)
  }

  private fun emitQueueUpdated(queue: WritableArray) {
    emitEvent("onQueueUpdated", queue)
  }

  private fun emitBindingStateChanged(binding: StoredBinding) {
    emitEvent("onBindingStateChanged", binding.toWritableMap())
  }

  private fun emitBindingStateCleared() {
    emitEvent("onBindingStateChanged", null)
  }

  private fun emitIdleSyncState(binding: StoredBinding?) {
    emitEvent("onSyncStateChanged", buildIdleSyncSummary(binding))
  }

  private fun emitSyncState(binding: StoredBinding?, uploadState: String) {
    emitEvent("onSyncStateChanged", buildIdleSyncSummary(binding, uploadState))
  }

  private fun emitError(code: String, message: String) {
    recordNativeLog("Error", "$code: $message", Log.ERROR)
    val error = Arguments.createMap().apply {
      putString("code", code)
      putString("message", message)
    }
    emitEvent("onError", error)
  }

  private fun emitEvent(eventName: String, payload: Any?) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun buildIdleSyncSummary(
    binding: StoredBinding?,
    uploadState: String = "idle",
  ): WritableMap {
    return Arguments.createMap().apply {
      putString("currentDeviceId", binding?.deviceId)
      putString("currentDeviceName", binding?.deviceAlias ?: binding?.deviceName)
      putDouble("currentSpeedMbps", 0.0)
      putDouble("transferredBytes", 0.0)
      putDouble("totalBytes", 0.0)
      putDouble("progressPercent", 0.0)
      putString("uploadState", uploadState)
      putString("performanceHint", "none")
      putNull("performanceMessage")
      putString("thermalState", "unknown")
      putString("activeTuningProfile", "idle")
      putBoolean("isThermalLimited", false)
      putDouble("completedCount", 0.0)
      putDouble("totalCount", 0.0)
      putDouble("completedBytes", 0.0)
      putDouble("currentFileConfirmedBytes", 0.0)
      putDouble("currentFileTotalBytes", 0.0)
      putString("sessionId", "")
      putString("state", uploadState)
    }
  }

  private fun loadBinding(): StoredBinding? {
    val raw = prefs.getString(PREF_BINDING, null) ?: return null
    return try {
      StoredBinding.fromJson(JSONObject(raw))
    } catch (_: Throwable) {
      null
    }
  }

  private fun saveBinding(binding: StoredBinding) {
    prefs.edit().putString(PREF_BINDING, binding.toJson().toString()).apply()
    rememberKnownDeviceId(binding.deviceId)
  }

  private fun clearBinding() {
    prefs.edit().remove(PREF_BINDING).apply()
  }

  private fun isoNow(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    formatter.timeZone = TimeZone.getTimeZone("UTC")
    return formatter.format(Date())
  }

  private fun localLogTimestamp(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
    formatter.timeZone = TimeZone.getDefault()
    return formatter.format(Date())
  }

  private fun diagnosticsLogSnapshot(): List<String> =
    synchronized(diagnosticsLogLock) {
      diagnosticsLogLines.toList()
    }

  private fun dumpDiagnosticsLogSnapshotToConsole(lines: List<String>) {
    if (lines.isEmpty()) {
      Log.d(
        MODULE_NAME,
        buildConsoleLogMessage(
          localTimestamp = localLogTimestamp(),
          category = "Diagnostics",
          message = "engine.log snapshot is empty at export time",
        ),
      )
      return
    }

    Log.d(
      MODULE_NAME,
      buildConsoleLogMessage(
        localTimestamp = localLogTimestamp(),
        category = "Diagnostics",
        message = "engine.log snapshot begin (${lines.size} lines)",
      ),
    )
    for (line in lines) {
      Log.d(
        MODULE_NAME,
        buildConsoleLogMessage(
          localTimestamp = localLogTimestamp(),
          category = "DiagnosticsLog",
          message = line,
        ),
      )
    }
    Log.d(
      MODULE_NAME,
      buildConsoleLogMessage(
        localTimestamp = localLogTimestamp(),
        category = "Diagnostics",
        message = "engine.log snapshot end",
      ),
    )
  }

  private fun buildDiagnosticsLogLine(
    timestampIso: String,
    category: String,
    message: String,
  ): String =
    "${timestampIso.trim()} [${normalizeLogCategory(category)}] ${normalizeLogMessage(message)}"

  private fun buildConsoleLogMessage(
    localTimestamp: String,
    category: String,
    message: String,
  ): String =
    "[${localTimestamp.trim()}] [${normalizeLogCategory(category)}] ${normalizeLogMessage(message)}"

  private fun retainRecentLogLines(lines: List<String>, maxLines: Int): List<String> {
    require(maxLines > 0) { "maxLines must be positive" }
    return if (lines.size <= maxLines) lines else lines.takeLast(maxLines)
  }

  private fun normalizeLogCategory(category: String): String =
    category.trim().ifBlank { "NativeSyncEngine" }

  private fun normalizeLogMessage(message: String): String =
    message.trim().ifBlank { "<empty>" }

  private fun getKnownDeviceIdsValue(): List<String> {
    val ids = mutableSetOf<String>()
    val storedIds = prefs.getStringSet(PREF_KNOWN_DEVICE_IDS, emptySet()) ?: emptySet()
    for (storedId in storedIds) {
      storedId.trim().takeIf { it.isNotBlank() }?.let(ids::add)
    }
    loadBinding()?.deviceId?.trim()?.takeIf { it.isNotBlank() }?.let(ids::add)
    return ids.sorted()
  }

  private fun rememberKnownDeviceId(deviceId: String) {
    val normalized = deviceId.trim()
    if (normalized.isBlank()) {
      return
    }

    val updated = getKnownDeviceIdsValue().toMutableSet()
    updated.add(normalized)
    prefs.edit().putStringSet(PREF_KNOWN_DEVICE_IDS, updated).apply()
  }

  private fun loadAutoUploadConfig(): AutoUploadConfig {
    return AutoUploadConfig(
      enabled = prefs.getBoolean(PREF_AUTO_UPLOAD_ENABLED, false),
      state = prefs.getString(PREF_AUTO_UPLOAD_STATE, "disabled")
        ?.takeIf { it.isNotBlank() }
        ?: "disabled",
      timeRangeMode = prefs.getString(PREF_AUTO_UPLOAD_TIME_RANGE_MODE, "all")
        ?.takeIf { it.isNotBlank() }
        ?: "all",
      customTimeFrom = prefs.getString(PREF_AUTO_UPLOAD_CUSTOM_TIME_FROM, null)
        ?.takeIf { it.isNotBlank() },
    )
  }

  private fun buildAutoUploadConfigMap(): WritableMap {
    val config = loadAutoUploadConfig()
    return Arguments.createMap().apply {
      putBoolean("enabled", config.enabled)
      putString("state", config.state)
      putString("timeRangeMode", config.timeRangeMode)
      if (config.customTimeFrom.isNullOrBlank()) {
        putNull("customTimeFrom")
      } else {
        putString("customTimeFrom", config.customTimeFrom)
      }
    }
  }

  private fun saveAutoUploadConfig(config: AutoUploadConfig) {
    val editor = prefs.edit()
      .putBoolean(PREF_AUTO_UPLOAD_ENABLED, config.enabled)
      .putString(PREF_AUTO_UPLOAD_STATE, config.state)
      .putString(PREF_AUTO_UPLOAD_TIME_RANGE_MODE, config.timeRangeMode)

    if (config.customTimeFrom.isNullOrBlank()) {
      editor.remove(PREF_AUTO_UPLOAD_CUSTOM_TIME_FROM)
    } else {
      editor.putString(PREF_AUTO_UPLOAD_CUSTOM_TIME_FROM, config.customTimeFrom)
    }
    editor.apply()
  }

  private fun persistAutoUploadInterruptedState() {
    val config = loadAutoUploadConfig()
    saveAutoUploadConfig(config.copy(enabled = true, state = "interrupted"))
  }

  private fun persistAutoUploadDisabledState() {
    val config = loadAutoUploadConfig()
    saveAutoUploadConfig(config.copy(enabled = false, state = "disabled"))
  }

  private fun persistAutoUploadActiveState() {
    val config = loadAutoUploadConfig()
    saveAutoUploadConfig(config.copy(enabled = true, state = "active"))
  }

  private fun ReadableMap.getStringOrNull(key: String): String? {
    return if (hasKey(key) && !isNull(key)) {
      getString(key)
    } else {
      null
    }
  }

  private fun readableMapToStringMap(map: ReadableMap?): Map<String, String> {
    if (map == null) {
      return emptyMap()
    }

    val result = mutableMapOf<String, String>()
    val iterator = map.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      if (!map.isNull(key)) {
        result[key] = map.getString(key).orEmpty()
      }
    }
    return result
  }

  private fun performDiagnosticsArchiveUpload(
    uploadUrl: String,
    archivePath: String,
    note: String,
    headers: Map<String, String>,
  ): WritableMap {
    if (uploadUrl.isBlank()) {
      throw NativeBridgeException("INVALID_UPLOAD_URL", "Missing diagnostics upload URL")
    }

    val archive = diagnosticsArchiveFileFromPath(archivePath)
    if (!archive.isFile) {
      throw NativeBridgeException("FILE_NOT_FOUND", "Diagnostics archive does not exist")
    }

    val boundary = "syncflow-${UUID.randomUUID()}"
    val connection = URL(uploadUrl).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"
      connection.doOutput = true
      connection.connectTimeout = DIAGNOSTICS_UPLOAD_TIMEOUT_MS
      connection.readTimeout = DIAGNOSTICS_UPLOAD_TIMEOUT_MS
      connection.setChunkedStreamingMode(0)

      for ((key, value) in headers) {
        if (!key.equals("Content-Type", ignoreCase = true) && key.isNotBlank()) {
          connection.setRequestProperty(key, value)
        }
      }
      connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
      diagnosticsUploadLog(
        "started url=$uploadUrl archive=${archive.name} bytes=${archive.length()} noteLen=${note.length}",
      )

      BufferedOutputStream(connection.outputStream).use { output ->
        writeMultipartField(output, boundary, "client_id", getOrCreateClientId())
        writeMultipartField(output, boundary, "platform", "android")
        if (note.isNotBlank()) {
          writeMultipartField(output, boundary, "note", note)
        }
        writeMultipartFile(output, boundary, "bundle", archive)
        writeUtf8(output, "--$boundary--\r\n")
      }

      val statusCode = connection.responseCode
      val responseBody = readResponseBody(connection, statusCode)
      diagnosticsUploadLog(
        "completed status=$statusCode responseBytes=${responseBody.toByteArray(StandardCharsets.UTF_8).size}",
      )

      if (statusCode == HttpURLConnection.HTTP_ENTITY_TOO_LARGE) {
        throw NativeBridgeException("BUNDLE_TOO_LARGE", "Diagnostics bundle too large")
      }
      if (statusCode != HttpURLConnection.HTTP_OK) {
        throw NativeBridgeException(
          "SERVER_ERROR",
          responseBody.takeIf { it.isNotBlank() } ?: "Diagnostics upload failed with HTTP $statusCode",
        )
      }

      val json = JSONObject(responseBody)
      val refId = json.optString("ref_id").takeIf { it.isNotBlank() }
        ?: throw NativeBridgeException("SERVER_ERROR", "Diagnostics upload response missing ref_id")
      val uploadedAt = json.optString("uploaded_at").takeIf { it.isNotBlank() }
        ?: throw NativeBridgeException("SERVER_ERROR", "Diagnostics upload response missing uploaded_at")

      return Arguments.createMap().apply {
        putString("ref_id", refId)
        putString("uploaded_at", uploadedAt)
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun diagnosticsArchiveFileFromPath(rawPath: String): File {
    val normalized = rawPath.trim()
    if (normalized.startsWith("file://")) {
      return File(Uri.parse(normalized).path.orEmpty())
    }
    return File(normalized)
  }

  private fun diagnosticsUploadLog(message: String) {
    recordNativeLog("DiagnosticsUpload", message)
  }

  private fun writeMultipartField(
    output: OutputStream,
    boundary: String,
    name: String,
    value: String,
  ) {
    writeUtf8(output, "--$boundary\r\n")
    writeUtf8(output, "Content-Disposition: form-data; name=\"$name\"\r\n\r\n")
    writeUtf8(output, value)
    writeUtf8(output, "\r\n")
  }

  private fun writeMultipartFile(
    output: OutputStream,
    boundary: String,
    name: String,
    file: File,
  ) {
    writeUtf8(output, "--$boundary\r\n")
    writeUtf8(
      output,
      "Content-Disposition: form-data; name=\"$name\"; filename=\"${file.name}\"\r\n",
    )
    writeUtf8(output, "Content-Type: application/zip\r\n\r\n")
    BufferedInputStream(file.inputStream()).use { input ->
      input.copyTo(output)
    }
    writeUtf8(output, "\r\n")
  }

  private fun writeUtf8(output: OutputStream, value: String) {
    output.write(value.toByteArray(StandardCharsets.UTF_8))
  }

  private fun readResponseBody(
    connection: HttpURLConnection,
    statusCode: Int,
  ): String {
    val stream = if (statusCode in 200..399) {
      connection.inputStream
    } else {
      connection.errorStream
    } ?: return ""

    return stream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
  }

  private val prefs
    get() = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun stopDiscoveryInternal(emitUpdate: Boolean) {
    synchronized(discoveryLock) {
      stopDiscoveryLocked()
    }
    if (emitUpdate) {
      emitDiscoveredDevicesChanged()
    }
  }

  private fun stopDiscoveryLocked() {
    discoveryGeneration += 1
    val manager = nsdManager
    val listener = discoveryListener
    if (manager != null && listener != null) {
      try {
        manager.stopServiceDiscovery(listener)
      } catch (_: IllegalArgumentException) {
        // Listener may not be registered yet or already stopped.
      } catch (_: Throwable) {
        // Ignore discovery cleanup failures.
      }
    }
    discoveryListener = null
    pendingResolveKeys.clear()
    discoveredCandidates.clear()
    reachableCandidates.clear()
    releaseMulticastLockLocked()
  }

  private fun createDiscoveryListener(
    manager: NsdManager,
    generation: Long,
  ): NsdManager.DiscoveryListener {
    return object : NsdManager.DiscoveryListener {
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
        handleDiscoveryFailure(
          generation = generation,
          code = "ANDROID_DISCOVERY_START_FAILED",
          message = "Android 局域网发现启动失败（$errorCode）",
        )
      }

      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
        handleDiscoveryFailure(
          generation = generation,
          code = "ANDROID_DISCOVERY_STOP_FAILED",
          message = "Android 局域网发现停止失败（$errorCode）",
        )
      }

      override fun onDiscoveryStarted(serviceType: String) {
        recordNativeLog("Discovery", "discovery started serviceType=$serviceType")
      }

      override fun onDiscoveryStopped(serviceType: String) {
        recordNativeLog("Discovery", "discovery stopped serviceType=$serviceType")
      }

      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (!isTargetServiceType(serviceInfo.serviceType)) {
          return
        }
        recordNativeLog(
          "Discovery",
          "service found name=${serviceInfo.serviceName} type=${serviceInfo.serviceType}",
        )
        resolveService(manager, generation, serviceInfo)
      }

      override fun onServiceLost(serviceInfo: NsdServiceInfo) {
        recordNativeLog("Discovery", "service lost name=${serviceInfo.serviceName} type=${serviceInfo.serviceType}")
        val serviceKey = serviceKeyFor(serviceInfo)
        val shouldEmit = synchronized(discoveryLock) {
          if (generation != discoveryGeneration) {
            return@synchronized false
          }
          pendingResolveKeys.remove(serviceKey)
          discoveredCandidates.remove(serviceKey)
          reachableCandidates.remove(serviceKey) != null
        }
        if (shouldEmit) {
          emitReachableDevices()
        }
      }
    }
  }

  private fun handleDiscoveryFailure(
    generation: Long,
    code: String,
    message: String,
  ) {
    synchronized(discoveryLock) {
      if (generation != discoveryGeneration) {
        return
      }
      stopDiscoveryLocked()
    }
    recordNativeLog("Discovery", "$code: $message", Log.WARN)
    emitDiscoveredDevicesChanged()
    emitError(code = code, message = message)
  }

  private fun resolveService(
    manager: NsdManager,
    generation: Long,
    serviceInfo: NsdServiceInfo,
  ) {
    val serviceKey = serviceKeyFor(serviceInfo)
    val shouldResolve = synchronized(discoveryLock) {
      if (generation != discoveryGeneration) {
        return@synchronized false
      }
      pendingResolveKeys.add(serviceKey)
    }

    if (!shouldResolve) {
      return
    }

    try {
      manager.resolveService(
        serviceInfo,
        object : NsdManager.ResolveListener {
          override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
            synchronized(discoveryLock) {
              pendingResolveKeys.remove(serviceKey)
            }
            recordNativeLog(
              "Discovery",
              "resolve failed name=${serviceInfo.serviceName} errorCode=$errorCode",
              Log.WARN,
            )
            emitError(
              code = "ANDROID_DISCOVERY_RESOLVE_FAILED",
              message = "解析局域网服务失败（$errorCode）",
            )
          }

          override fun onServiceResolved(resolvedServiceInfo: NsdServiceInfo) {
            val candidate = buildDiscoveredCandidate(resolvedServiceInfo)
            recordNativeLog(
              "Discovery",
              "resolved name=${candidate.name} host=${candidate.ip} probeHost=${candidate.probeHost} port=${candidate.port}",
            )
            synchronized(discoveryLock) {
              pendingResolveKeys.remove(serviceKey)
              if (generation != discoveryGeneration) {
                return
              }
              discoveredCandidates[serviceKey] = candidate
            }
            probeReachability(candidate, generation)
          }
        },
      )
    } catch (error: Throwable) {
      synchronized(discoveryLock) {
        pendingResolveKeys.remove(serviceKey)
      }
      recordNativeLog("Discovery", "resolve submit failed: ${error.message ?: error.javaClass.simpleName}", Log.ERROR)
      emitError(
        code = "ANDROID_DISCOVERY_RESOLVE_FAILED",
        message = "提交局域网服务解析失败：${error.message ?: "unknown error"}",
      )
    }
  }

  private fun buildDiscoveredCandidate(serviceInfo: NsdServiceInfo): DiscoveredServiceCandidate {
    val attributes = parseTxtAttributes(serviceInfo)
    val resolvedHost = serviceInfo.host?.hostAddress.orEmpty()
    val advertisedIp = attributes["ip"].orEmpty()
    val initialIp = preferredDisplayHost(advertisedIp, resolvedHost)
    val probeHost = preferredProbeHost(advertisedIp, resolvedHost)
    val serviceName = serviceInfo.serviceName.takeIf { it.isNotBlank() } ?: "SyncFlow Desktop"

    return DiscoveredServiceCandidate(
      serviceKey = serviceKeyFor(serviceInfo),
      deviceId = attributes["id"]?.takeIf { it.isNotBlank() } ?: serviceName,
      name = attributes["name"]?.takeIf { it.isNotBlank() } ?: serviceName,
      type = when (attributes["type"]) {
        "win" -> "win"
        else -> "mac"
      },
      ip = initialIp,
      probeHost = probeHost,
      port = serviceInfo.port.takeIf { it > 0 } ?: DEFAULT_PROTOCOL_PORT,
      protoVersion = attributes["proto"]?.toIntOrNull() ?: PROTOCOL_VERSION,
      authMode = attributes["auth"]?.takeIf { it == "code" } ?: "code",
      shareEnabled = attributes["share"] == "1",
      shareName = attributes["shareName"]?.takeIf { it.isNotBlank() },
      lastSeenAt = isoNow(),
    )
  }

  private fun probeReachability(
    candidate: DiscoveredServiceCandidate,
    generation: Long,
  ) {
    if (candidate.probeHost.isBlank()) {
      val shouldEmit = synchronized(discoveryLock) {
        if (generation != discoveryGeneration) {
          return@synchronized false
        }
        reachableCandidates.remove(candidate.serviceKey) != null
      }
      if (shouldEmit) {
        emitReachableDevices()
      }
      return
    }

    thread(name = "NativeSyncEngineDiscoveryProbe", isDaemon = true) {
      try {
        Socket().use { socket ->
          socket.connect(
            InetSocketAddress(candidate.probeHost, candidate.port),
            DISCOVERY_PROBE_TIMEOUT_MS,
          )
          socket.soTimeout = DISCOVERY_PROBE_TIMEOUT_MS

          val probedHost = socket.inetAddress?.hostAddress.orEmpty()
          val resolvedIp = preferredDisplayHost(candidate.ip, probedHost)
          val reachable = candidate.copy(
            ip = resolvedIp,
            lastSeenAt = isoNow(),
          )

          synchronized(discoveryLock) {
            if (generation != discoveryGeneration) {
              return@thread
            }
            if (!discoveredCandidates.containsKey(candidate.serviceKey)) {
              return@thread
            }
            reachableCandidates[candidate.serviceKey] = reachable
          }
        }
        recordNativeLog("Discovery", "reachable ${candidate.name} via ${candidate.probeHost}")
        emitReachableDevices()
      } catch (_: Throwable) {
        recordNativeLog("Discovery", "reachability failed ${candidate.name} via ${candidate.probeHost}", Log.WARN)
        val shouldEmit = synchronized(discoveryLock) {
          if (generation != discoveryGeneration) {
            return@synchronized false
          }
          reachableCandidates.remove(candidate.serviceKey) != null
        }
        if (shouldEmit) {
          emitReachableDevices()
        }
      }
    }
  }

  private fun emitReachableDevices() {
    val payload = synchronized(discoveryLock) {
      buildReachableDevicesPayloadLocked()
    }
    emitDiscoveredDevicesChanged(payload)
  }

  private fun buildReachableDevicesPayloadLocked(): WritableArray {
    val latestByDeviceId = linkedMapOf<String, DiscoveredServiceCandidate>()
    for (candidate in reachableCandidates.values) {
      val existing = latestByDeviceId[candidate.deviceId]
      if (existing == null || candidate.lastSeenAt > existing.lastSeenAt) {
        latestByDeviceId[candidate.deviceId] = candidate
      }
    }

    val sorted = latestByDeviceId.values.sortedWith(
      compareBy<DiscoveredServiceCandidate>(
        { it.name.lowercase(Locale.US) },
        { it.deviceId.lowercase(Locale.US) },
      ),
    )

    return Arguments.createArray().apply {
      for (candidate in sorted) {
        pushMap(candidate.toWritableMap())
      }
    }
  }

  private fun parseTxtAttributes(serviceInfo: NsdServiceInfo): Map<String, String> {
    val attributes = mutableMapOf<String, String>()
    for ((key, value) in serviceInfo.attributes) {
      attributes[key] = value?.toString(StandardCharsets.UTF_8).orEmpty()
    }
    return attributes
  }

  private fun serviceKeyFor(serviceInfo: NsdServiceInfo): String {
    val serviceType = normalizeServiceType(serviceInfo.serviceType)
    return "${serviceInfo.serviceName}|$serviceType"
  }

  private fun normalizeServiceType(serviceType: String): String {
    var normalized = serviceType.trim().lowercase(Locale.US)
    while (normalized.endsWith(".")) {
      normalized = normalized.dropLast(1)
    }
    normalized = normalized.removeSuffix(".local")
    while (normalized.endsWith(".")) {
      normalized = normalized.dropLast(1)
    }
    return normalized
  }

  private fun isTargetServiceType(serviceType: String): Boolean {
    val normalized = normalizeServiceType(serviceType)
    return normalized.isEmpty() || normalized == BONJOUR_SERVICE_TYPE
  }

  private fun acquireMulticastLockLocked() {
    if (multicastLock?.isHeld == true) {
      return
    }

    val wifiManager = reactApplicationContext.applicationContext
      .getSystemService(Context.WIFI_SERVICE) as? WifiManager
      ?: return

    multicastLock = wifiManager.createMulticastLock("syncflow:discovery").apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  private fun releaseMulticastLockLocked() {
    try {
      if (multicastLock?.isHeld == true) {
        multicastLock?.release()
      }
    } catch (_: Throwable) {
      // Ignore multicast cleanup failures.
    } finally {
      multicastLock = null
    }
  }

  private fun preferredProbeHost(advertisedIp: String, resolvedHost: String): String {
    if (isIPv4Address(advertisedIp)) {
      return advertisedIp
    }
    return resolvedHost
  }

  private fun preferredDisplayHost(primaryHost: String, fallbackHost: String): String {
    if (isIPv4Address(fallbackHost)) {
      return fallbackHost
    }
    if (isIPv4Address(primaryHost)) {
      return primaryHost
    }
    if (fallbackHost.isNotBlank()) {
      return fallbackHost
    }
    return primaryHost
  }

  private fun isIPv4Address(host: String): Boolean {
    return host.isNotEmpty() &&
      host.matches(Regex("^\\d{1,3}(?:\\.\\d{1,3}){3}$"))
  }

  private data class StoredBinding(
    val deviceId: String,
    val deviceName: String,
    val deviceAlias: String,
    val host: String,
    val port: Int,
    val pairingId: String,
    val shareEnabled: Boolean,
    val shareName: String?,
    val lastBoundAt: String,
    val connectionState: String,
  ) {
    fun toWritableMap(): WritableMap {
      return Arguments.createMap().apply {
        putString("deviceId", deviceId)
        putString("deviceName", deviceName)
        putString("deviceAlias", deviceAlias)
        putString("host", host)
        putInt("port", port)
        putString("pairingId", pairingId)
        putBoolean("shareEnabled", shareEnabled)
        if (shareName.isNullOrBlank()) {
          putNull("shareName")
        } else {
          putString("shareName", shareName)
        }
        putString("lastBoundAt", lastBoundAt)
        putString("connectionState", connectionState)
      }
    }

    fun toJson(): JSONObject {
      return JSONObject().apply {
        put("deviceId", deviceId)
        put("deviceName", deviceName)
        put("deviceAlias", deviceAlias)
        put("host", host)
        put("port", port)
        put("pairingId", pairingId)
        put("shareEnabled", shareEnabled)
        put("shareName", shareName ?: JSONObject.NULL)
        put("lastBoundAt", lastBoundAt)
        put("connectionState", connectionState)
      }
    }

    companion object {
      fun fromJson(json: JSONObject): StoredBinding {
        return StoredBinding(
          deviceId = json.optString("deviceId"),
          deviceName = json.optString("deviceName"),
          deviceAlias = json.optString("deviceAlias")
            .ifBlank { json.optString("deviceName") },
          host = json.optString("host"),
          port = json.optInt("port", DEFAULT_PROTOCOL_PORT),
          pairingId = json.optString("pairingId"),
          shareEnabled = json.optBoolean("shareEnabled", false),
          shareName = json.optString("shareName").takeIf { it.isNotBlank() },
          lastBoundAt = json.optString("lastBoundAt"),
          connectionState = json.optString("connectionState")
            .ifBlank { "bound" },
        )
      }
    }
  }

  private data class DiscoveredServiceCandidate(
    val serviceKey: String,
    val deviceId: String,
    val name: String,
    val type: String,
    val ip: String,
    val probeHost: String,
    val port: Int,
    val protoVersion: Int,
    val authMode: String,
    val shareEnabled: Boolean,
    val shareName: String?,
    val lastSeenAt: String,
  ) {
    fun toWritableMap(): WritableMap {
      return Arguments.createMap().apply {
        putString("deviceId", deviceId)
        putString("name", name)
        putString("type", type)
        putString("ip", ip)
        putInt("port", port)
        putInt("protoVersion", protoVersion)
        putString("authMode", authMode)
        putBoolean("shareEnabled", shareEnabled)
        if (shareName.isNullOrBlank()) {
          putNull("shareName")
        } else {
          putString("shareName", shareName)
        }
        putString("lastSeenAt", lastSeenAt)
      }
    }
  }

  private data class AutoUploadConfig(
    val enabled: Boolean,
    val state: String,
    val timeRangeMode: String,
    val customTimeFrom: String?,
  )

  private class NativeBridgeException(
    val nativeCode: String,
    message: String,
  ) : Exception(message)

  companion object {
    private const val MODULE_NAME = "NativeSyncEngine"
    private const val MAX_DIAGNOSTICS_LOG_LINES = 2_000
    private const val PHOTO_PERMISSION_REQUEST_CODE = 39_394
    private const val DIAGNOSTICS_UPLOAD_TIMEOUT_MS = 30_000
    private const val ANDROID_14_API = 34
    private const val PERMISSION_READ_MEDIA_VISUAL_USER_SELECTED =
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
    const val PREFS_NAME = "syncflow.android.native_sync_engine"
    private const val PREF_BINDING = "binding"
    private const val PREF_CLIENT_ID = "client_id"
    private const val PREF_CLIENT_DISPLAY_NAME = "client_display_name"
    private const val PREF_KNOWN_DEVICE_IDS = "known_device_ids"
    private const val PREF_AUTO_UPLOAD_ENABLED = "auto_upload_enabled"
    private const val PREF_AUTO_UPLOAD_STATE = "auto_upload_state"
    private const val PREF_AUTO_UPLOAD_TIME_RANGE_MODE = "auto_upload_time_range_mode"
    private const val PREF_AUTO_UPLOAD_CUSTOM_TIME_FROM = "auto_upload_custom_time_from"
    /** Auth-layer EncryptedSharedPreferences file (react-native-keychain service).
     *  Mirror of the iOS Keychain service `cn.vividrop.auth`. */
    const val AUTH_KEYCHAIN_PREFS_NAME = "cn.vividrop.auth"
    /** UserDefaults/SharedPrefs key — seeded on first launch, survives only as
     *  long as the app install does, so a missing marker uniquely identifies
     *  a fresh / reinstalled app. */
    const val PREF_INSTALL_MARKER = "vivi_install_marker"
    /** 2-phase wipe flag. Set before clearing, removed after. If present on
     *  cold start the wipe was killed mid-way and the sentinel retries. */
    const val PREF_WIPE_IN_PROGRESS = "vivi_wipe_in_progress"
    /** Numeric auth user id last bound to this sync identity. Absent means
     *  "no owner recorded" (fresh install / post-wipe). */
    const val PREF_OWNER_USER_ID = "lastSyncOwnerUserId"
    private const val SOCKET_TIMEOUT_MS = 5_000
    private const val HEADER_SIZE = 12
    private const val MAX_BODY_LENGTH = 64 * 1024 * 1024
    private const val DEFAULT_PROTOCOL_PORT = 39_393
    private const val BONJOUR_SERVICE_TYPE = "_syncflow._tcp"
    private const val CONNECTION_CODE_LENGTH = 6
    private const val DISCOVERY_PROBE_TIMEOUT_MS = 2_000
    private val MAGIC_BYTES = byteArrayOf('L'.code.toByte(), 'M'.code.toByte(), 'U'.code.toByte(), 'P'.code.toByte())
    private const val PROTOCOL_VERSION = 2
    private const val TYPE_HELLO_REQ = 0x0001
    private const val TYPE_HELLO_RES = 0x0002
    private const val TYPE_PAIR_REQ = 0x0003
    private const val TYPE_PAIR_RES = 0x0004

    /**
     * Keys that survive a wipe. Everything else stored in this prefs file
     * — current or future — is treated as sync-identity and cleared. The
     * allowlist shape is preventive: if Android later grows a local
     * upload queue / history / auto-upload config under a new pref key,
     * wipe will pick it up automatically instead of silently leaving a
     * per-account artifact behind.
     *
     * Preserved:
     *  - `client_display_name` — device label (not account data)
     *  - `vivi_install_marker` — reinstall sentinel (stays set for the
     *    lifetime of the install; cleared only by app deletion)
     *  - `vivi_wipe_in_progress` — 2-phase self-heal flag; managed by
     *    wipe itself (set at top, cleared at bottom)
     */
    private val SYNC_IDENTITY_PRESERVED_KEYS: Set<String> = setOf(
      PREF_CLIENT_DISPLAY_NAME,
      PREF_INSTALL_MARKER,
      PREF_WIPE_IN_PROGRESS,
    )

    /**
     * Clear every sync-identity field in SharedPreferences. Uses an
     * allowlist of keys to preserve (see `SYNC_IDENTITY_PRESERVED_KEYS`)
     * rather than an explicit per-key removal list, so future sync-state
     * additions are covered by default.
     *
     * Uses a 2-phase `PREF_WIPE_IN_PROGRESS` flag so a crash mid-wipe can
     * be detected and retried by the reinstall sentinel.
     *
     * Called from both the JS-facing `wipeSyncIdentity` bridge method and
     * from `MainApplication.onCreate` (reinstall / self-heal paths —
     * before the React context exists).
     */
    fun performWipeSyncIdentity(prefs: android.content.SharedPreferences) {
      // Synchronous write — the 2-phase self-heal contract relies on this
      // flag being observable on disk if we are killed between here and
      // the clear-flag at the bottom. `apply()` would only queue it in
      // memory and defer the flush, defeating the retry mechanism.
      prefs.edit().putString(PREF_WIPE_IN_PROGRESS, "1").commit()
      val keysToRemove = prefs.all.keys
        .filterNot { it in SYNC_IDENTITY_PRESERVED_KEYS }
      val editor = prefs.edit()
      for (key in keysToRemove) {
        editor.remove(key)
      }
      editor.apply()
      // Async flush is acceptable here — if we die between here and the
      // disk flush, next cold start just sees the flag still set and runs
      // wipe again, which is idempotent against already-cleared state.
      prefs.edit().remove(PREF_WIPE_IN_PROGRESS).apply()
    }

    /**
     * Remove the auth-layer EncryptedSharedPreferences file. Mirror of
     * `AuthKeychainCleaner.clearPersistedTokens()` on iOS. Safe to call when
     * the file does not exist (returns false, logged as no-op).
     *
     * Uses `Context.deleteSharedPreferences` (API 24+, well below the RN
     * 0.84 minSdk floor).
     */
    fun clearAuthKeychainStorage(context: android.content.Context) {
      val removed = context.deleteSharedPreferences(AUTH_KEYCHAIN_PREFS_NAME)
      android.util.Log.i(
        "NativeSyncEngineModule",
        if (removed) "cleared auth keychain prefs ($AUTH_KEYCHAIN_PREFS_NAME)"
        else "no auth keychain prefs to clear ($AUTH_KEYCHAIN_PREFS_NAME)",
      )
    }
  }
}
