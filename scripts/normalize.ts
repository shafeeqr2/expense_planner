import type { TxnKind } from '../src/types.ts'

const PROVINCES = 'ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU|CA|NJ|NY|WA|NS|DE|FL|TX|IL|MA|GA|CO|NV|VA|AZ|OR|MN|OH|MI|PA|NC'

/**
 * Produce a stable merchant key from a raw description.
 * Goal: all "SHOPPERS DRUG MART 871 TORONTO ON" variants collapse to "SHOPPERS DRUG MART".
 */
export function normalizeMerchant(raw: string, account: 'chequing' | 'visa'): string {
  let s = raw.toUpperCase().trim()

  if (account === 'chequing') {
    // Strip bank-side prefixes, keep the counterparty
    s = s
      .replace(/^CONTACTLESS INTERAC PURCHASE\s*-\s*\d*\s*/, '')
      .replace(/^INTERAC PURCHASE\s*-\s*\d*\s*/, '')
      .replace(/^VISA DEBIT PURCHASE\s*-\s*\d*\s*/, '')
      .replace(/^VISA DEBIT (REFUND|CREDIT)\s*-\s*\d*\s*/, '')
      .replace(/^MISC PAYMENT\s+/, '')
      .replace(/^BILL PAYMENT\s+/, '')
      .replace(/^(HYDRO|UTILITY|INSURANCE|TELEPHONE|CABLE) BILL PMT\s+/, '')
      .replace(/^INSURANCE\s+/, '')
      .replace(/^PAYROLL DEPOSIT\s+/, 'PAYROLL ')
      .replace(/^INVESTMENT\s+/, 'INVESTMENT ')
      .replace(/^ONLINE TRANSFER (SENT|RECEIVED)\s*-\s*\d*\s*/, (_m, d) => `TRANSFER ${d} `)
      .replace(/^E-TRANSFER\s*-\s*AUTODEPOSIT\s*/, 'ETRANSFER RECEIVED ')
      .replace(/^E-TRANSFER (SENT|RECEIVED)\s+/, (_m, d) => `ETRANSFER ${d} `)
      .replace(/^E-TRANSFER REQUEST FULFILLED.*/, 'ETRANSFER REQUEST FULFILLED')
      .replace(/^(ETRANSFER (?:SENT|RECEIVED) .*?)\s+(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\s*$/, '$1') // trailing reference code
      .replace(/^(ETRANSFER (?:SENT|RECEIVED) .*?)\s+C1A[A-Z0-9]+\s*$/, '$1')
      .replace(/^FUNDS TRANSFER CREDIT TT\s+.*/, 'WIRE TRANSFER RECEIVED')
      .replace(/\bREMITLY\b.*/, 'REMITLY')
      .replace(/\bMEHDI COMPANY\b.*/, 'MEHDI COMPANY')
      .replace(/\bPAYPER\b.*/, 'PAYPER')
      .replace(/\bIQBAL (HALAL )?FOO.*/, 'IQBAL HALAL FOODS')
      .replace(/\bISLAMIC RELIEF\b.*/, 'ISLAMIC RELIEF')
      .replace(/\bBENEVITY\b.*/, 'BENEVITY')
      .replace(/\bWYSE METER\b.*/, 'WYSE METER')
      .replace(/\bCOSTCO\b.*/, 'COSTCO')
      .replace(/^ATM WITHDRAWAL\s*-.*$/, 'ATM WITHDRAWAL')
      .replace(/^WWW PAYMENT\s*-\s*\S+/, 'WWW PAYMENT')
      .replace(/^ONLINE BANKING TRANSFER\s*-\s*\d*/, 'ONLINE BANKING TRANSFER')
      .replace(/^ONLINE TRANSFER TO DEPOSIT ACCOUNT\s*-\s*\d*/, 'TRANSFER TO DEPOSIT ACCOUNT')
      .replace(/^ONLINE TRANSFER FROM DEPOSIT ACCOUNT\s*-\s*\d*/, 'TRANSFER FROM DEPOSIT ACCOUNT')
      .replace(/^OVERDRAFT HANDLING FEE.*$/, 'OVERDRAFT HANDLING FEE')
      .replace(/^FEE ELECTRONIC TRANSACTION.*$/, 'ELECTRONIC TRANSACTION FEE')
      .replace(/^NSF ITEM FEE.*$/, 'NSF ITEM FEE')
      .replace(/^SAFE DEPOSIT BOX FEE.*$/, 'SAFE DEPOSIT BOX FEE')
      .replace(/\(BMO\)|\(TD\)|\(CIBC\)|\(SCOTIA\)|\(RBC\)|\(TANGERINE\)/g, '')
  } else {
    // Visa: strip payment processor prefixes and transaction ids
    s = s
      .replace(/^(SQ|TST|SP|PAYPAL|PP|GOOGLE|APPLE\.COM\/BILL|DD|UEP)\s*\*\s*/, '')
      .replace(/^(SQ|TST|SP|DD)\s*-\s*/, '')
      .replace(/\*[A-Z0-9]{6,}\b/g, '') // AMAZON.CA*P16GL0293
      .replace(/\bAMZN MKTP CA\b.*/, 'AMAZON MARKETPLACE')
      .replace(/\bAMAZON\.CA\b.*/, 'AMAZON.CA')
      .replace(/\bAMAZON CHANNELS\b.*/, 'AMAZON CHANNELS')
      .replace(/\bAMAZON PRIME\b.*/, 'AMAZON PRIME')
      .replace(/\bAUDIBLE\b.*/, 'AUDIBLE')
      .replace(/\bUBER\s*(BV|HOLDINGS|CANADA|\*|EATS|TRIP|PENDING)?.*/, (m) => (/EATS/.test(m) ? 'UBER EATS' : 'UBER'))
      .replace(/\bPRESTO\b.*/, 'PRESTO')
      .replace(/\bTIM HORTO.*/, 'TIM HORTONS')
      .replace(/\bSHOPPERS ?DRUG ?MART.*/, 'SHOPPERS DRUG MART')
      .replace(/\bDOLLARA.*/, 'DOLLARAMA')
      .replace(/\bIQBAL (HALAL )?FOO.*/, 'IQBAL HALAL FOODS')
      .replace(/\bISLAMIC RELIEF\b.*/, 'ISLAMIC RELIEF')
      .replace(/\bBENEVITY\b.*/, 'BENEVITY')
      .replace(/\bFIT4LESS\b.*/, 'FIT4LESS')
      .replace(/\bSTARBUCKS\b.*/, 'STARBUCKS')
      .replace(/\bNO ?FRILLS\b.*/, 'NO FRILLS')
      .replace(/\bFRESHCO\b.*/, 'FRESHCO')
      .replace(/\bFOOD BASICS\b.*/, 'FOOD BASICS')
      .replace(/\bMETRO\b(?! TORONTO).*/, 'METRO')
      .replace(/\bLOBLAWS\b.*/, 'LOBLAWS')
      .replace(/\bCANADIAN TIRE\b.*/, 'CANADIAN TIRE')
      .replace(/\bHOME DEPOT\b.*/, 'HOME DEPOT')
      .replace(/\bIKEA\b.*/, 'IKEA')
      .replace(/\bWINNERS\b.*/, 'WINNERS')
      .replace(/\bMARSHALLS\b.*/, 'MARSHALLS')
      .replace(/\bHOMESENSE\b.*/, 'HOMESENSE')
      .replace(/\bPOPEYES\b.*/, 'POPEYES')
      .replace(/\bSUBWAY\b.*/, 'SUBWAY')
      .replace(/\bPIZZA PIZZA\b.*/, 'PIZZA PIZZA')
      .replace(/\bDOORDASH\b.*/, 'DOORDASH')
      .replace(/\bSKIP ?THE ?DISHES\b.*/, 'SKIP THE DISHES')
      .replace(/\b407[- ]?ETR\b.*/, '407 ETR')
      .replace(/\bGREEN P\b.*/, 'GREEN P PARKING')
      .replace(/\bBRITISH A(IRWAYS)?\b.*/, 'BRITISH AIRWAYS')
      .replace(/\bEMIRATES( AI)?\b.*/, 'EMIRATES')
      .replace(/\bAIR CAN(ADA)?\b.*/, 'AIR CANADA')
      .replace(/\bETIHAD\b.*/, 'ETIHAD AIRWAYS')
      .replace(/\bLUFTHANSA\b.*/, 'LUFTHANSA')
      .replace(/\bUNITED AIR\b.*/, 'UNITED AIRLINES')
      .replace(/\bSAUDI AIR\b.*/, 'SAUDIA')
      .replace(/\bQATAR AIR\b.*/, 'QATAR AIRWAYS')
      .replace(/\bWESTJET\b.*/, 'WESTJET')
      .replace(/\bPORTER AIR\b.*/, 'PORTER AIRLINES')
      .replace(/\bTURKISH AIR\b.*/, 'TURKISH AIRLINES')
      .replace(/\bEXPEDIA\b.*/, 'EXPEDIA')
      .replace(/\bBOOKING\.COM\b.*/, 'BOOKING.COM')
      .replace(/\bAIRBNB\b.*/, 'AIRBNB')
      .replace(/\bLYFT\b.*/, 'LYFT')
      .replace(/\bSPOTIFY\b.*/, 'SPOTIFY')
      .replace(/\bAPPLE\.COM\/BILL\b.*/, 'APPLE')
      .replace(/\bGOOGLE ?\*?\s*(YOUTUBE|GOOGLE ONE|CLOUD|PLAY|STORAGE|STADIA|FI)\b.*/, 'GOOGLE $1')
      .replace(/\bMICROSOFT\b.*/, 'MICROSOFT')
      .replace(/\bOPENAI\b.*/, 'OPENAI')
      .replace(/\bANTHROPIC\b.*/, 'ANTHROPIC')
      .replace(/\d{10,}[A-Z.]*/g, ' ') // glued ticket numbers "0652171604495TORONTO"
      .replace(/\bMCDONALD'?S\b.*/, 'MCDONALDS')
      .replace(/\bWAL-?MART\b.*/, 'WALMART')
      .replace(/\bCOSTCO\b.*/, 'COSTCO')
      .replace(/\bLCBO\b.*/, 'LCBO')
      .replace(/\bPETRO-?CAN(ADA)?\b.*/, 'PETRO-CANADA')
      .replace(/\bESSO\b.*/, 'ESSO')
      .replace(/\bSHELL\b.*/, 'SHELL')
      .replace(/\bNETFLIX\b.*/, 'NETFLIX')
      .replace(/\bSPOTIFY\b.*/, 'SPOTIFY')
      .replace(/\bPAYMENT - THANK YOU.*/, 'PAYMENT - THANK YOU')
      .replace(/\bAUTOMATIC PAYMENT - THANK YOU.*/, 'PAYMENT - THANK YOU')
      .replace(/^PURCHASE INTEREST.*/, 'PURCHASE INTEREST')
      .replace(/^CASH ADVANCE INTEREST.*/, 'CASH ADVANCE INTEREST')
      .replace(/^CASH INTEREST.*/, 'CASH ADVANCE INTEREST')
      .replace(/^OVERLIMIT FEE.*/, 'OVERLIMIT FEE')
      // trailing phone numbers, cities, provinces
      .replace(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g, '')
      .replace(/\b\d{3}-\d{4}\b/g, '')
      .replace(/\b(WWW\.)?[A-Z0-9-]+\.(COM|CA|CO|NET|ORG|IO)(\/[A-Z0-9]+)?\b/g, (m) => (s.startsWith(m) ? m : ''))
      .replace(new RegExp(`\\s+(TORONTO|EAST YORK|NORTH YORK|SCARBOROUGH|MISSISSAUGA|MARKHAM|ETOBICOKE|VAUGHAN|THORNHILL|RICHMOND HILL|PICKERING|AJAX|WHITBY|OSHAWA|BRAMPTON|OAKVILLE|BURLINGTON|HAMILTON|OTTAWA|MONTREAL|VANCOUVER|CALGARY|EDMONTON|KINGSTON|LONDON|WATERLOO|KITCHENER|GUELPH|BARRIE|NIAGARA FALLS|WINDSOR|SEATTLE|NEW YORK|DOWNTOWN TORO|THORNCLIFF?E?|DON MILLS|LEASIDE)\\s*(${PROVINCES})?\\s*$`), '')
      .replace(new RegExp(`\\s+(${PROVINCES})\\s*$`), '')
      .replace(new RegExp(`(\\S)(${PROVINCES})$`), '$1') // "TOROON" style glued province
  }

  s = s
    .replace(/#\s*\d+/g, '')          // store numbers "#3349"
    .replace(/\b\d{4,}\b/g, '')       // long numeric ids
    .replace(/\bQPS\b|\bINC\.?$|\bLTD\.?$|\bCORP\.?$|\bCO\.?$/g, '')
    .replace(/[*]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-,.]+$/g, '')
    .trim()

  return s || raw.toUpperCase().trim()
}

export function classifyKind(raw: string, account: 'chequing' | 'visa', amount: number): TxnKind {
  const d = raw.toUpperCase()
  if (account === 'visa') {
    if (/PAYMENT - THANK YOU/.test(d)) return 'transfer'
    if (/INTEREST/.test(d)) return 'interest'
    if (/OVERLIMIT FEE|ANNUAL FEE|CASH ADVANCE FEE|NSF FEE/.test(d)) return 'fee'
    if (/CASH ADVANCE/.test(d)) return 'cash'
    return amount > 0 ? 'refund' : 'purchase'
  }
  if (/REBATE|REVERSAL|REVERSED|CANCEL/.test(d) && amount > 0) return 'refund'
  if (/PAYROLL|CANADA\s+FED|GST|HST|PROV\/LOC GVT|CHILD TAX|CTB|REFUND.*CRA|EI CANADA|INTEREST CREDIT|DIVIDEND/.test(d) && amount > 0) return 'income'
  if (/MONTHLY FEE|OVERDRAFT HANDLING|SAFE DEPOSIT BOX|SERVICE CHARGE|\bNSF\b|STOP PAYMENT|TRANSACTION FEE|E-TRANSFER FEE/.test(d)) return 'fee'
  if (/OVERDRAFT INTEREST|INTEREST/.test(d)) return 'interest'
  if (/ATM WITHDRAWAL|CASH WITHDRAWAL/.test(d)) return 'cash'
  if (/INVESTMENT|WS INVESTMENTS|CDN SHR INVEST|WEALTHSIMPLE|QUESTRADE|TFSA|RRSP|RESP/.test(d)) return 'investment'
  if (/RBC CREDIT CARD|FIND & SAVE|ONLINE BANKING TRANSFER|TRANSFER TO DEPOSIT|TRANSFER FROM DEPOSIT|AUTO TRANSFER|WWW PAYMENT|VISA PAYMENT|MASTERCARD PAYMENT|CREDIT CARD PAYMENT/.test(d)) return 'transfer'
  if (/ONLINE TRANSFER (SENT|RECEIVED)|E-TRANSFER|INTERAC E-TRF|AUTODEPOSIT/.test(d)) return 'etransfer'
  if (/BILL PAYMENT|BILL PMT|INSURANCE|HYDRO|UTILITY/.test(d)) return 'bill'
  if (/PURCHASE/.test(d)) return amount > 0 ? 'refund' : 'purchase'
  if (/MISC PAYMENT/.test(d)) return 'bill'
  return amount > 0 ? 'income' : 'purchase'
}
