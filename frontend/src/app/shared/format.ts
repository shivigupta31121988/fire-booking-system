const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export const eur = (n: number | null | undefined): string => (n === null || n === undefined ? '' : money.format(n));
export const mb = (bytes: number): string => (bytes / 1048576 >= 0.1 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');
