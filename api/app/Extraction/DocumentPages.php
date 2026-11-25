<?php

namespace App\Extraction;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

/**
 * Turns an upload into the images a vision model reads.
 *
 * Photos go through as they are. PDFs are rendered to PNG with poppler's
 * pdftoppm (installed in the Docker images), because every OpenAI-compatible
 * vision API accepts images, while PDF input varies by provider.
 */
class DocumentPages
{
    public const RESOLUTION_DPI = 150; // sharp enough for 8pt text, ~1240×1750 px per A4 page

    /**
     * @return array{pages: list<DocumentPage>, total_pages: int}
     */
    public function fromUpload(string $contents, string $mime, int $maxPages): array
    {
        if ($mime !== 'application/pdf') {
            return ['pages' => [new DocumentPage($mime, base64_encode($contents))], 'total_pages' => 1];
        }

        $directory = sys_get_temp_dir().'/invoiceflow-'.Str::random(16);
        File::ensureDirectoryExists($directory);

        try {
            $pdf = "{$directory}/document.pdf";
            File::put($pdf, $contents);

            $info = Process::timeout(20)->run(['pdfinfo', $pdf]);
            if ($info->failed() || ! preg_match('/^Pages:\s+(\d+)/m', $info->output(), $matches)) {
                throw ExtractionException::unreadablePdf();
            }
            $totalPages = (int) $matches[1];

            $render = Process::timeout(60)->run([
                'pdftoppm', '-png', '-r', (string) self::RESOLUTION_DPI,
                '-f', '1', '-l', (string) $maxPages,
                $pdf, "{$directory}/page",
            ]);
            if ($render->failed()) {
                throw ExtractionException::unreadablePdf();
            }

            // page-1.png, page-2.png … (zero-padded when there are 10+ pages, so a plain sort works)
            $files = glob("{$directory}/page-*.png") ?: [];
            sort($files);

            $pages = array_map(
                fn (string $file) => new DocumentPage('image/png', base64_encode(File::get($file))),
                $files,
            );

            if ($pages === []) {
                throw ExtractionException::unreadablePdf();
            }

            return ['pages' => $pages, 'total_pages' => $totalPages];
        } finally {
            File::deleteDirectory($directory);
        }
    }
}
