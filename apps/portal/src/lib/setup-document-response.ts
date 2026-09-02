/** Always download stored bytes; never render arbitrary uploaded HTML. */
export function setupDocumentResponse(body: Buffer, title: string) {
        const format = body.subarray(0, 1024).includes(Buffer.from('%PDF')) ? { type: 'application/pdf', extension: 'pdf' }
            : body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? { type: 'image/png', extension: 'png' }
            : body.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? { type: 'image/jpeg', extension: 'jpg' }
            : { type: 'application/octet-stream', extension: 'bin' };
        return new Response(new Uint8Array(body), { headers: { 'Content-Type': format.type, 'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9._ -]/g, '_')}.${format.extension}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
