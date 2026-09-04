export async function generateCustomsCaseNumber(
  client: any,
  accountId: string,
  year?: number
): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const candidate = `CC-${targetYear}-${randomNum}`;
    const existing = await client.customsCase.findFirst({
      where: {
        accountId,
        caseNumber: candidate,
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `CC-${targetYear}-${Date.now().toString().slice(-6)}`;
}
