# Stay on browser plugin API v4

PI WEB offers a v5 browser plugin API, and `1.202610.6+` logs a deprecation warning for v4 plugins — including its own bundled ones. Casual targets v4 so the same package runs on `1.202610.3` and newer, using the public catalog when the host exposes it and the selection service when it does not.

## Consequences

- One published artifact supports both the oldest and the current host versions.
- Capability differences are handled at runtime in the browser: catalog discovery when available, selection service and the host's **+** button otherwise.
- The plugin will keep emitting a deprecation warning in the console on newer hosts until it moves to v5.
- Moving to v5 is a deliberate breaking change: it must drop `1.202610.3` support and update the compatibility table rather than degrade quietly.
