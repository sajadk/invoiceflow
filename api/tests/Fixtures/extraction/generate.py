"""
Generates the AI capture evaluation set: fictional supplier invoices in
different layouts, each with the answer the extractor should produce.

    pip install reportlab pillow      # plus poppler-utils for the photo variant
    python3 api/tests/Fixtures/extraction/generate.py

Writes <name>.pdf (or .jpg) and <name>.expected.json next to this script.
Run `php artisan invoiceflow:eval-extraction` to score the configured model on them.

Every company name and TRN here is made up (see DemoCompanies.php).
"""

import json
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
WIDTH, HEIGHT = A4


@dataclass
class Line:
    description: str
    quantity: float
    unit_price: int  # fils, excluding VAT
    vat: int  # percent: 5 or 0

    @property
    def amount(self) -> int:
        # Same half-up integer maths as InvoiceCalculator::lineTotal
        return (round(self.quantity * 1000) * self.unit_price + 500) // 1000

    @property
    def line_vat(self) -> int:
        return (self.amount * self.vat + 50) // 100


@dataclass
class Invoice:
    name: str
    supplier: str
    supplier_address: list[str]
    trn: str | None
    number: str
    issue_date: str  # ISO
    issue_label: str  # as printed
    due_date: str | None
    due_label: str | None
    lines: list[Line]
    title: str = "TAX INVOICE"
    customer: list[str] = field(default_factory=lambda: [
        "Bill to:", "Demo Trading LLC", "Office 1204, Example Tower", "Business Bay, Dubai", "TRN: 100000000099999",
    ])

    def totals(self) -> dict:
        # VAT once per rate on the summed lines, like InvoiceCalculator::totals
        taxable: dict[int, int] = {}
        for line in self.lines:
            taxable[line.vat] = taxable.get(line.vat, 0) + line.amount
        subtotal = sum(taxable.values())
        vat = sum((amount * rate + 50) // 100 for rate, amount in taxable.items())
        return {"subtotal": subtotal, "vat_total": vat, "total": subtotal + vat}

    def expected(self) -> dict:
        return {
            "supplier_name": self.supplier,
            "supplier_trn": self.trn.replace(" ", "").replace("-", "") if self.trn else None,
            "supplier_invoice_number": self.number,
            "issue_date": self.issue_date,
            "due_date": self.due_date,
            "currency": "AED",
            "items": [
                {
                    "description": line.description,
                    "quantity": f"{line.quantity:.3f}",
                    "unit_price": line.unit_price,
                    "vat_rate": "standard" if line.vat == 5 else "zero",
                }
                for line in self.lines
            ],
            "totals": self.totals(),
        }


def aed(fils: int) -> str:
    return f"{fils / 100:,.2f}"


def qty(value: float) -> str:
    return f"{value:,.3f}".rstrip("0").rstrip(".")


# --- Layouts -------------------------------------------------------------------


def header(c: canvas.Canvas, inv: Invoice, accent) -> float:
    c.setFillColor(accent)
    c.rect(0, HEIGHT - 28 * mm, WIDTH, 28 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(18 * mm, HEIGHT - 15 * mm, inv.supplier)
    c.setFont("Helvetica", 8.5)
    c.drawString(18 * mm, HEIGHT - 21 * mm, " · ".join(inv.supplier_address))
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(WIDTH - 18 * mm, HEIGHT - 15 * mm, inv.title)
    if inv.trn:
        c.setFont("Helvetica", 8.5)
        c.drawRightString(WIDTH - 18 * mm, HEIGHT - 21 * mm, f"TRN {inv.trn}")

    c.setFillColor(colors.black)
    y = HEIGHT - 40 * mm
    c.setFont("Helvetica", 9)
    for i, text in enumerate(inv.customer):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 9)
        c.drawString(18 * mm, y - i * 4.6 * mm, text)

    meta = [("Invoice no.", inv.number), ("Invoice date", inv.issue_label)]
    if inv.due_label:
        meta.append(("Due date", inv.due_label))
    for i, (label, value) in enumerate(meta):
        c.setFont("Helvetica", 9)
        c.drawRightString(WIDTH - 60 * mm, y - i * 4.6 * mm, label)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(WIDTH - 18 * mm, y - i * 4.6 * mm, value)
    return y - max(len(inv.customer), len(meta)) * 4.6 * mm - 8 * mm


def totals_block(c: canvas.Canvas, inv: Invoice, y: float, vat_label="VAT 5%") -> float:
    t = inv.totals()
    rows = [("Subtotal (excl. VAT)", aed(t["subtotal"]))]
    if t["vat_total"] or inv.trn:
        rows.append((vat_label, aed(t["vat_total"])))
    rows.append(("Total AED", aed(t["total"])))
    for i, (label, value) in enumerate(rows):
        last = i == len(rows) - 1
        c.setFont("Helvetica-Bold" if last else "Helvetica", 10 if last else 9)
        c.drawRightString(WIDTH - 55 * mm, y - i * 6 * mm, label)
        c.drawRightString(WIDTH - 18 * mm, y - i * 6 * mm, value)
    return y - len(rows) * 6 * mm


def footer(c: canvas.Canvas, text: str) -> None:
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.grey)
    c.drawString(18 * mm, 15 * mm, text)
    c.drawString(18 * mm, 11 * mm, "Bank: Example Bank PJSC · IBAN AE00 0000 0000 0000 0000 000 · Fictional document for testing.")
    c.setFillColor(colors.black)


def classic(inv: Invoice, path: Path, accent=colors.HexColor("#1e3a8a"), lines_per_page=30) -> None:
    """Qty · Unit price · VAT % · Amount. Optionally spills over several pages."""
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(f"{inv.title} {inv.number}")
    chunks = [inv.lines[i:i + lines_per_page] for i in range(0, len(inv.lines), lines_per_page)]
    for page, chunk in enumerate(chunks, start=1):
        y = header(c, inv, accent) if page == 1 else HEIGHT - 25 * mm
        if page > 1:
            c.setFont("Helvetica", 8.5)
            c.drawString(18 * mm, HEIGHT - 15 * mm, f"{inv.supplier} · Invoice {inv.number} (continued)")
        cols = [(18 * mm, "Description", "l"), (120 * mm, "Qty", "r"), (145 * mm, "Unit price", "r"),
                (165 * mm, "VAT", "r"), (WIDTH - 18 * mm, "Amount", "r")]
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.rect(15 * mm, y - 2 * mm, WIDTH - 30 * mm, 7 * mm, stroke=0, fill=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8.5)
        for x, title, align in cols:
            (c.drawString if align == "l" else c.drawRightString)(x, y, title)
        y -= 7 * mm
        c.setFont("Helvetica", 8.5)
        for line in chunk:
            values = [line.description, qty(line.quantity), aed(line.unit_price), f"{line.vat}%", aed(line.amount)]
            for (x, _, align), value in zip(cols, values):
                (c.drawString if align == "l" else c.drawRightString)(x, y, value)
            y -= 5.6 * mm
        if page < len(chunks):
            c.setFont("Helvetica-Oblique", 8)
            c.drawRightString(WIDTH - 18 * mm, y - 2 * mm, f"Continued on page {page + 1}")
        else:
            totals_block(c, inv, y - 6 * mm)
        footer(c, f"Page {page} of {len(chunks)} · Thank you for your business.")
        c.showPage()
    c.save()


def vat_columns(inv: Invoice, path: Path) -> None:
    """Shows unit price excl. VAT, the VAT amount and a VAT-inclusive amount per line."""
    c = canvas.Canvas(str(path), pagesize=A4)
    y = header(c, inv, colors.HexColor("#0f766e"))
    cols = [(18 * mm, "Service", "l"), (100 * mm, "Qty", "r"), (127 * mm, "Rate excl. VAT", "r"),
            (150 * mm, "VAT 5%", "r"), (WIDTH - 18 * mm, "Amount incl. VAT", "r")]
    c.setFont("Helvetica-Bold", 8.5)
    for x, title, align in cols:
        (c.drawString if align == "l" else c.drawRightString)(x, y, title)
    c.line(18 * mm, y - 2 * mm, WIDTH - 18 * mm, y - 2 * mm)
    y -= 8 * mm
    c.setFont("Helvetica", 9)
    for line in inv.lines:
        values = [line.description, qty(line.quantity), aed(line.unit_price), aed(line.line_vat), aed(line.amount + line.line_vat)]
        for (x, _, align), value in zip(cols, values):
            (c.drawString if align == "l" else c.drawRightString)(x, y, value)
        y -= 6 * mm
    c.line(18 * mm, y + 2 * mm, WIDTH - 18 * mm, y + 2 * mm)
    totals_block(c, inv, y - 6 * mm, vat_label="Total VAT (5%)")
    footer(c, "Account summary is for information only. Amounts in UAE Dirhams.")
    c.save()


def simple(inv: Invoice, path: Path) -> None:
    """A small business that isn't VAT-registered: plain 'Invoice', no TRN, no VAT."""
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(18 * mm, HEIGHT - 25 * mm, inv.supplier)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, HEIGHT - 31 * mm, ", ".join(inv.supplier_address))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(18 * mm, HEIGHT - 45 * mm, f"{inv.title} #{inv.number}")
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, HEIGHT - 51 * mm, f"Date: {inv.issue_label}")
    c.drawString(18 * mm, HEIGHT - 56 * mm, "To: Demo Trading LLC, Business Bay, Dubai")
    y = HEIGHT - 70 * mm
    for line in inv.lines:
        c.drawString(18 * mm, y, f"{line.description}  ({qty(line.quantity)} × AED {aed(line.unit_price)})")
        c.drawRightString(WIDTH - 18 * mm, y, f"AED {aed(line.amount)}")
        y -= 6 * mm
    c.line(18 * mm, y + 2 * mm, WIDTH - 18 * mm, y + 2 * mm)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y - 4 * mm, "Total due")
    c.drawRightString(WIDTH - 18 * mm, y - 4 * mm, f"AED {aed(inv.totals()['total'])}")
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, y - 14 * mm, "Not registered for VAT. Payment by bank transfer within 14 days.")
    c.save()


def as_photo(pdf: Path, jpg: Path) -> None:
    """Renders the PDF and makes it look like a phone photo: tilted, soft, on a desk, JPEG-compressed."""
    from PIL import Image, ImageFilter, ImageEnhance

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", "1", "-l", "1", str(pdf), f"{tmp}/p"], check=True)
        page = Image.open(next(Path(tmp).glob("p-*.png"))).convert("RGB")
    page = ImageEnhance.Brightness(page).enhance(0.93)
    rotated = page.rotate(2.5, expand=True, fillcolor=(96, 84, 72), resample=Image.BICUBIC)
    desk = Image.new("RGB", (rotated.width + 120, rotated.height + 120), (96, 84, 72))
    desk.paste(rotated, (60, 70))
    desk = desk.filter(ImageFilter.GaussianBlur(0.7))
    desk.save(jpg, "JPEG", quality=68)


# --- The set -------------------------------------------------------------------

INVOICES = [
    (classic, Invoice(
        name="office-supplies",
        supplier="Example Office Supplies LLC",
        supplier_address=["Warehouse 7, Al Quoz Industrial 3", "Dubai, UAE"],
        trn="100000000012345",
        number="EOS-2026-0412",
        issue_date="2026-03-12", issue_label="12 Mar 2026",
        due_date="2026-04-11", due_label="11 Apr 2026",
        lines=[
            Line("A4 copier paper, 80gsm (box of 5 reams)", 10, 2250, 5),
            Line("Toner cartridge, black, high yield", 2, 34500, 5),
            Line("Desk organiser, mesh", 3, 4875, 5),
        ],
    )),
    (classic, Invoice(
        name="freight-mixed-rates",
        supplier="Placeholder Freight Forwarding FZE",
        supplier_address=["Plot S1-07, Jebel Ali Free Zone", "Dubai, UAE"],
        trn="100000000023456",
        number="PFF/INV/7781",
        # Day-first: 05/02 is 5 February, not 2 May.
        issue_date="2026-02-05", issue_label="05/02/2026",
        due_date="2026-03-07", due_label="07/03/2026",
        lines=[
            Line("International air freight DXB-FRA, 120 kg", 1, 185000, 0),
            Line("Customs clearance and documentation", 1, 35000, 5),
            Line("Local delivery, Dubai", 2, 12000, 5),
        ],
    )),
    (lambda inv, path: classic(inv, path, colors.HexColor("#6d28d9"), lines_per_page=16), Invoice(
        name="software-two-pages",
        supplier="Demo Software Licensing FZ-LLC",
        supplier_address=["Office 310, Building 2, Dubai Internet City", "UAE"],
        trn="100000000034567",
        number="DSL-10-2026-118",
        issue_date="2026-10-01", issue_label="01-Oct-2026",
        due_date="2026-10-31", due_label="31-Oct-2026",
        lines=[Line(f"Workspace seat licence, October (user {n:02d})", 1, 7500, 5) for n in range(1, 21)]
        + [
            Line("Shared storage add-on, 1 TB", 2, 9900, 5),
            Line("Priority support plan", 1, 45000, 5),
        ],
    )),
    (simple, Invoice(
        name="catering-no-trn",
        title="Invoice",
        supplier="Placeholder Catering LLC",
        supplier_address=["Shop 4, Example Street, Al Karama", "Dubai"],
        trn=None,
        number="PC-0098",
        issue_date="2026-03-18", issue_label="18 March 2026",
        due_date=None, due_label=None,
        lines=[
            Line("Office lunch buffet", 25, 4500, 0),
            Line("Delivery and setup", 1, 5000, 0),
        ],
    )),
    (vat_columns, Invoice(
        name="telecom-vat-columns",
        supplier="Demo Telecom Services LLC",
        supplier_address=["Example Business Centre, Sheikh Zayed Road", "Dubai, UAE"],
        trn="100000000045678",
        number="DTS-55120934",
        issue_date="2026-02-28", issue_label="28/02/2026",
        due_date="2026-03-15", due_label="15/03/2026",
        lines=[
            Line("Business fibre 500 Mbps, March", 1, 69900, 5),
            Line("Mobile plan, Business Unlimited", 4, 12500, 5),
            Line("Static IP address", 1, 5000, 5),
        ],
    )),
]

PHOTO = Invoice(
    name="printing-photo",
    supplier="Example Printing Press LLC",
    supplier_address=["Unit 12, Example Printing Hub, Al Qusais", "Dubai, UAE"],
    trn="100000000056789",
    number="EPP 2231",
    issue_date="2026-01-09", issue_label="09/01/2026",
    due_date="2026-02-08", due_label="08/02/2026",
    lines=[
        Line("Business cards, 350gsm matt, 2 names", 500, 35, 5),
        Line("Brochures A5, 4 pages, full colour", 1000, 120, 5),
        Line("Roll-up banner 85 x 200 cm", 2, 28500, 5),
    ],
)


def write_expected(inv: Invoice) -> None:
    (HERE / f"{inv.name}.expected.json").write_text(json.dumps(inv.expected(), indent=2) + "\n")


def main() -> None:
    for layout, inv in INVOICES:
        layout(inv, HERE / f"{inv.name}.pdf")
        write_expected(inv)
        print(f"{inv.name}.pdf")

    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "photo.pdf"
        classic(PHOTO, pdf, colors.HexColor("#b45309"))
        as_photo(pdf, HERE / f"{PHOTO.name}.jpg")
    write_expected(PHOTO)
    print(f"{PHOTO.name}.jpg")


if __name__ == "__main__":
    main()
