/**
 * Convert a number to Thai Baht text.
 * @param {number|string} num - The number to convert.
 * @returns {string} The Thai Baht text representation.
 */
function thaiBaht(num) {
    if (num === null || num === undefined || num === '' || isNaN(Number(num))) {
        return 'ศูนย์บาทถ้วน';
    }

    // Convert to string and round to 2 decimal places to prevent floating-point precision issues
    const value = parseFloat(num).toFixed(2);
    const [bahtStr, satangStr] = value.split('.');

    const bahtVal = parseInt(bahtStr, 10);
    const satangVal = parseInt(satangStr, 10);

    if (bahtVal === 0 && satangVal === 0) {
        return 'ศูนย์บาทถ้วน';
    }

    let result = '';

    if (bahtVal > 0) {
        result += convertSection(bahtStr) + 'บาท';
    }

    if (satangVal > 0) {
        result += convertSection(satangStr) + 'สตางค์';
    } else {
        result += 'ถ้วน';
    }

    return result;
}

function convertSection(numberStr) {
    const THAI_NUMBERS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    let text = '';
    const length = numberStr.length;

    if (length > 7) {
        const millionPosition = length - 6;
        const millionPart = numberStr.substring(0, millionPosition);
        const remainingPart = numberStr.substring(millionPosition);
        return convertSection(millionPart) + 'ล้าน' + convertSection(remainingPart);
    }

    for (let i = 0; i < length; i++) {
        const digit = parseInt(numberStr.charAt(i), 10);
        const position = length - i - 1;

        if (digit !== 0) {
            // Tens position special rules
            if (position === 1) {
                if (digit === 1) {
                    text += 'สิบ';
                } else if (digit === 2) {
                    text += 'ยี่สิบ';
                } else {
                    text += THAI_NUMBERS[digit] + 'สิบ';
                }
            } 
            // Units position special rules
            else if (position === 0 && length > 1) {
                if (digit === 1) {
                    text += 'เอ็ด';
                } else {
                    text += THAI_NUMBERS[digit];
                }
            } 
            // Other positions
            else {
                text += THAI_NUMBERS[digit] + THAI_UNITS[position];
            }
        }
    }

    return text;
}

// Export if we want to run in testing environments (Node)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { thaiBaht };
}
