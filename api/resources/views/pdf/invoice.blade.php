@php
    /** @var \App\Models\Invoice $invoice */
    $money = fn (int $fils) => number_format($fils / 100, 2);
    $qty = fn (string $q) => rtrim(rtrim($q, '0'), '.');
    // Sent invoices show the details frozen at send time; drafts show the live customer.
    $billedTo = $invoice->billed_to ?? [
        'name' => $invoice->customer->name,
        'email' => $invoice->customer->email,
        'trn' => $invoice->customer->trn,
        'emirate' => $invoice->customer->emirate?->label(),
        'address' => $invoice->customer->address,
    ];
    $watermark = match ($invoice->status->value) {
        'draft' => 'DRAFT',
        'void' => 'VOID',
        'paid' => 'PAID',
        default => null,
    };
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $invoice->number ?? 'Draft invoice' }}</title>
    <style>
        @page { margin: 36px 40px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10.5px; color: #0f172a; }
        h1 { font-size: 22px; margin: 0; letter-spacing: 1px; color: #0f766e; }
        .muted { color: #64748b; }
        .small { font-size: 9px; }
        table { width: 100%; border-collapse: collapse; }
        .header td { vertical-align: top; }
        .right { text-align: right; }
        .meta td { padding: 2px 0; }
        .box { margin-top: 24px; }
        .label { font-size: 8.5px; text-transform: uppercase; letter-spacing: .8px; color: #64748b; margin-bottom: 4px; }
        .items { margin-top: 24px; }
        .items th { background: #f1f5f9; font-size: 8.5px; text-transform: uppercase; letter-spacing: .6px; color: #475569; padding: 7px 8px; text-align: left; }
        .items td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .totals { width: 45%; margin-left: 55%; margin-top: 16px; }
        .totals td { padding: 4px 8px; }
        .totals .grand td { border-top: 2px solid #0f172a; font-weight: bold; font-size: 12px; padding-top: 8px; }
        .notes { margin-top: 28px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #0f766e; }
        .watermark { position: fixed; top: 38%; left: 0; width: 100%; text-align: center; font-size: 110px; font-weight: bold; color: #e2e8f0; transform: rotate(-30deg); z-index: -1; }
        .footer { position: fixed; bottom: -10px; left: 0; right: 0; text-align: center; }
    </style>
</head>
<body>
@if ($watermark)
    <div class="watermark">{{ $watermark }}</div>
@endif

<table class="header">
    <tr>
        <td>
            <h1>TAX INVOICE</h1>
            <div class="muted" style="margin-top: 6px;">{{ $seller->name }}</div>
            <div class="muted">{{ $seller->email }}</div>
        </td>
        <td class="right">
            <table class="meta" style="width: auto; margin-left: auto;">
                <tr><td class="muted">Invoice no.&nbsp;&nbsp;</td><td class="right"><strong>{{ $invoice->number ?? 'Draft' }}</strong></td></tr>
                <tr><td class="muted">Issue date&nbsp;&nbsp;</td><td class="right">{{ $invoice->issue_date->format('d M Y') }}</td></tr>
                <tr><td class="muted">Due date&nbsp;&nbsp;</td><td class="right">{{ $invoice->due_date->format('d M Y') }}</td></tr>
                <tr><td class="muted">Currency&nbsp;&nbsp;</td><td class="right">{{ $invoice->currency }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box">
    <div class="label">Billed to</div>
    <strong>{{ $billedTo['name'] }}</strong><br>
    @if ($billedTo['address']){{ $billedTo['address'] }}<br>@endif
    @if ($billedTo['emirate']){{ $billedTo['emirate'] }}, United Arab Emirates<br>@endif
    @if ($billedTo['email']){{ $billedTo['email'] }}<br>@endif
    @if ($billedTo['trn'])<span class="muted">TRN</span> {{ $billedTo['trn'] }}@endif
</div>

<table class="items">
    <thead>
    <tr>
        <th style="width: 4%;">#</th>
        <th>Description</th>
        <th class="right" style="width: 9%;">Qty</th>
        <th class="right" style="width: 15%;">Unit price</th>
        <th class="right" style="width: 12%;">VAT</th>
        <th class="right" style="width: 16%;">Amount</th>
    </tr>
    </thead>
    <tbody>
    @foreach ($invoice->items as $item)
        <tr>
            <td class="muted">{{ $item->position }}</td>
            <td>{{ $item->description }}</td>
            <td class="right">{{ $qty($item->quantity) }}</td>
            <td class="right">{{ $money($item->unit_price) }}</td>
            <td class="right">{{ $item->vat_rate->label() }}</td>
            <td class="right">{{ $money($item->line_total) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<table class="totals">
    <tr><td class="muted">Subtotal (excl. VAT)</td><td class="right">{{ $money($invoice->subtotal) }}</td></tr>
    @foreach ($invoice->vatBreakdown() as $row)
        <tr>
            <td class="muted">{{ $row['label'] }} on {{ $money($row['taxable']) }}</td>
            <td class="right">{{ $money($row['vat']) }}</td>
        </tr>
    @endforeach
    <tr class="grand"><td>Total {{ $invoice->currency }}</td><td class="right">{{ $money($invoice->total) }}</td></tr>
</table>

@if ($invoice->notes)
    <div class="notes">
        <div class="label">Notes</div>
        {!! nl2br(e($invoice->notes)) !!}
    </div>
@endif

<div class="footer small muted">
    {{ $invoice->number ?? 'Draft' }} · Generated by InvoiceFlow
</div>
</body>
</html>
