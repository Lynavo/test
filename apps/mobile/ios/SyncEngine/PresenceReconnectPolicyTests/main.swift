import Foundation

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        fputs("PresenceReconnectPolicyTests failed: \(message)\n", stderr)
        exit(1)
    }
}

expect(
    PresenceReconnectPolicy.shouldProbeWhenDiscoveryAlreadyBrowsing(
        hasBinding: true,
        isDiscoveryBrowsing: true,
        bindingState: "offline",
        presenceHost: "172.16.20.108"
    ),
    "startDiscovery must probe the bound desktop when discovery is already browsing and the binding is offline"
)

expect(
    PresenceReconnectPolicy.shouldScheduleDelayedProbeAfterRecoveryExhausted(
        hasBinding: true,
        isDiscoveryBrowsing: true,
        bindingState: "offline",
        presenceHost: "172.16.20.108"
    ),
    "presence recovery exhaustion must schedule another LAN probe even when discovery is already browsing"
)

expect(
    !PresenceReconnectPolicy.shouldProbeWhenDiscoveryAlreadyBrowsing(
        hasBinding: true,
        isDiscoveryBrowsing: true,
        bindingState: "connected",
        presenceHost: "172.16.20.108"
    ),
    "connected bindings should stay on the normal heartbeat path instead of starting extra reconnect probes"
)

expect(
    !PresenceReconnectPolicy.shouldScheduleDelayedProbeAfterRecoveryExhausted(
        hasBinding: false,
        isDiscoveryBrowsing: true,
        bindingState: "offline",
        presenceHost: "172.16.20.108"
    ),
    "unbound mobile apps must not run desktop reconnect probes"
)

expect(
    !PresenceReconnectPolicy.shouldProbeWhenDiscoveryAlreadyBrowsing(
        hasBinding: true,
        isDiscoveryBrowsing: true,
        bindingState: "offline",
        presenceHost: nil
    ),
    "offline reconnect probes need a usable presence host"
)

expect(
    !PresenceReconnectPolicy.shouldProbeWhenDiscoveryAlreadyBrowsing(
        hasBinding: true,
        isDiscoveryBrowsing: true,
        bindingState: "offline",
        presenceHost: "8.8.8.8"
    ),
    "offline reconnect probes must stay scoped to private LAN hosts"
)

expect(
    PresenceReconnectPolicy.presenceResponseMatchesBinding(
        expectedDeviceId: "desktop-1",
        responseServerId: "desktop-1"
    ),
    "presence responses from the bound desktop should pass identity validation"
)

expect(
    !PresenceReconnectPolicy.presenceResponseMatchesBinding(
        expectedDeviceId: "desktop-1",
        responseServerId: "desktop-2"
    ),
    "presence responses from a different desktop must not mark the binding connected"
)

expect(
    !PresenceReconnectPolicy.presenceResponseMatchesBinding(
        expectedDeviceId: "desktop-1",
        responseServerId: nil
    ),
    "presence responses without serverId must not mark the binding connected"
)

expect(
    PresenceReconnectPolicy.delayedProbeIntervalAfterRecoveryExhausted(consecutiveDelayedProbeFailures: 0) == 5,
    "first delayed LAN probe after recovery exhaustion should run quickly"
)

expect(
    PresenceReconnectPolicy.delayedProbeIntervalAfterRecoveryExhausted(consecutiveDelayedProbeFailures: 5) == 5,
    "early delayed LAN probe failures should keep the fast reconnect cadence"
)

expect(
    PresenceReconnectPolicy.delayedProbeIntervalAfterRecoveryExhausted(consecutiveDelayedProbeFailures: 6) == 30,
    "delayed LAN probes should back off after repeated failures"
)
