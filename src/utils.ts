
export function generateRandomAlphanumeric(length: number, startWithCapital: boolean = false): string {
  const uppercaseCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseCharset = 'abcdefghijklmnopqrstuvwxyz';
  const numericCharset = '0123456789';
  const fullCharset = uppercaseCharset + lowercaseCharset + numericCharset;
  
  let result = '';
  
  if (startWithCapital && length > 0) {
    const randomIndex = Math.floor(Math.random() * uppercaseCharset.length);
    result += uppercaseCharset[randomIndex];
    length--;
  }
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * fullCharset.length);
    result += fullCharset[randomIndex];
  }
  
  return result;
}

export function isAbsoluteURL(url: string): boolean {
  // Regular expression to match absolute URLs
  const absoluteURLRegex = /^(?:[a-z+]+:)?\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i;

  return absoluteURLRegex.test(url);
}

export function convertYesToBoolean(value: any): boolean {
  if (value === undefined) return false;

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalizedValue = value.trim().toLowerCase();
  return ['yes', 'y', 'true', '1'].includes(normalizedValue);
}
