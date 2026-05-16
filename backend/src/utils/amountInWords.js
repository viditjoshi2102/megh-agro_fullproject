const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
               'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
               'Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function twoDigits(n) {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n) {
  if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  return twoDigits(n);
}

function numberToWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  if (n >= 10000000) { parts.push(threeDigits(Math.floor(n / 10000000)) + ' Crore'); n %= 10000000; }
  if (n >= 100000)   { parts.push(threeDigits(Math.floor(n / 100000))   + ' Lakh');  n %= 100000; }
  if (n >= 1000)     { parts.push(threeDigits(Math.floor(n / 1000))     + ' Thousand'); n %= 1000; }
  if (n > 0)         { parts.push(threeDigits(n)); }
  return parts.join(' ');
}

function amountInWords(amount) {
  const rounded = Math.round(Number(amount));
  const rupees  = Math.floor(rounded);
  const paisa   = Math.round((Number(amount) - rupees) * 100);
  let result = 'Rupees ' + numberToWords(rupees);
  if (paisa > 0) result += ' and ' + numberToWords(paisa) + ' Paise';
  result += ' Only';
  return result;
}

module.exports = { amountInWords };
