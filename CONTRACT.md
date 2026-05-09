# Socket.IO Event Contract

Backend emits:

```ts
fleet_state: { ships: Ship[]; timestamp: number }
alert_created: Alert
alerts_state: { alerts: Alert[] }
zone_updated: { action: 'create' | 'update' | 'delete'; zone: Zone }
zones_state: { zones: Zone[] }
distress_parsed: DistressParseResult
snapshot_response: { requestId: string; snapshot: Ship[]; timestamp: number }
playback_window: { start: number; end: number; count: number }
directive_received: Directive
```

Frontend emits:

```ts
create_zone: { id: string; coordinates: [number, number][]; label: string }
update_zone: { id: string; coordinates: [number, number][] }
delete_zone: { id: string }
send_directive: { shipId: string; type: DirectiveType; payload: object }
directive_response: { directiveId: string; shipId: string; response: 'ACCEPT' | 'ESCALATE_DISTRESS'; distressMessage?: string }
join_ship_room: { shipId: string }
join_command_room: {}
request_snapshot: { requestId: string; timestamp: number }
acknowledge_alert: { alertId: string }
```

Shared rule: the backend owns live state. The frontend renders socket state, interpolates marker positions, and emits user intent.
