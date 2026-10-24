export type StaffAlertKind = 'booking' | 'session';
export type StaffAlertStage = '15m' | '10m' | '5m' | 'due' | 'extra';

export function staffAlertDismissalKey(kind: StaffAlertKind, resourceId: string, stage: StaffAlertStage): string {
  return `${kind}:${resourceId}:${stage}`;
}
