export const fmt = new Intl.NumberFormat('en-US');
export const kib = (bytes: number) => `${fmt.format(Math.round(bytes / 1024))} KiB`;
