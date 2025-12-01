export const formatCurrency = (amount: number, currency = 'THB') => {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
};
