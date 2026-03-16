// Excel export utility
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.join(","));

    // Data rows
    data.forEach((row) => {
        const values = headers.map((header) => {
            const val = row[header];
            const str = val !== null && val !== undefined ? String(val) : "";
            // Escape commas and quotes
            return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
