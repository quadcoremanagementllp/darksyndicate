function isMissingTable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021';
}

export async function readAlertDismissalIds(
  readPrimary: () => Promise<string[]>,
  readActivityLog: () => Promise<string[]>,
): Promise<string[]> {
  let primary: string[] = [];
  try {
    primary = await readPrimary();
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  const activityLog = await readActivityLog();
  return [...new Set([...primary, ...activityLog])];
}

export async function saveAlertDismissal(
  savePrimary: () => Promise<void>,
  saveActivityLog: () => Promise<void>,
): Promise<void> {
  try {
    await savePrimary();
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    await saveActivityLog();
  }
}
