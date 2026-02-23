/**
 * Formats a numeric value into Angolan Kwanza (Kz) format.
 * Example: 1000 -> Kz 1.000,00
 */
export const formatCurrency = (value) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'Kz 0,00';

    // Manual formatting for better RN compatibility (Hermes)
    const formatted = num.toFixed(2)
        .replace('.', ',')
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `Kz ${formatted}`;
};

/**
 * Formats a date string into a readable Portuguese format.
 * Example: 2024-01-20T10:00:00Z -> 20 Jan 2024, 10:00
 */
export const formatDate = (dateString) => {
    if (!dateString) return '---';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '---';

    return date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
