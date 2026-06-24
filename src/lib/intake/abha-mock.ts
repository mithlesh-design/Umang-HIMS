// src/lib/intake/abha-mock.ts

export interface AbhaEligibilityResult {
  eligible: boolean
  schemeName: 'AB-PMJAY' | 'CMHIS-UP' | ''
  coverage: string
  preAuthRef: string
}

export async function checkAbhaEligibility(
  abhaId: string,
  ayushmanCardNo: string,
): Promise<AbhaEligibilityResult> {
  await new Promise(r => setTimeout(r, 1200))

  // Simulate not-eligible for ABHA IDs starting with "00-"
  if (abhaId.startsWith('00-')) {
    return { eligible: false, schemeName: '', coverage: '', preAuthRef: '' }
  }

  // Minimum length guard (mirrors UI validation)
  if (abhaId.length < 8 || ayushmanCardNo.length < 6) {
    return { eligible: false, schemeName: '', coverage: '', preAuthRef: '' }
  }

  const schemeName = ayushmanCardNo.toUpperCase().startsWith('UP-') ? 'CMHIS-UP' : 'AB-PMJAY'
  const preAuthRef = `PMJAY-PRE-${Math.floor(1000000 + Math.random() * 9000000)}`

  return {
    eligible: true,
    schemeName,
    coverage: schemeName === 'CMHIS-UP'
      ? 'Covered up to ₹5,00,000/year (CMHIS-UP)'
      : 'Covered up to ₹5,00,000/year (AB-PMJAY)',
    preAuthRef,
  }
}
