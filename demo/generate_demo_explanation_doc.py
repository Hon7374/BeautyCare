from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = ROOT / "beautycare-demo-explanation.docx"
VIDEO_FILE = ROOT / "beautycare-full-demo.mkv"


SECTIONS = [
    (
        "1. Mo terminal va khoi dong ung dung",
        [
            "Doan dau video cho thay terminal backend duoc mo de xac nhan server BeautyCare da chay tren localhost.",
            "Phan nay co y nghia ky thuat: nguoi xem thay ro demo dang chay bang du an that, khong phai video render gia lap.",
            "Ngay sau do browser desktop duoc mo de tiep tuc thao tac tren giao dien that.",
        ],
    ),
    (
        "2. Trang chu cong khai",
        [
            "Clip mo vao trang landing page cua BeautyCare.",
            "Muc dich la gioi thieu giao dien public, khu vuc hero, dieu huong va cac thong tin noi bat truoc khi dang nhap.",
            "Doan nay chung minh frontend public da len dung va co the truy cap tu localhost.",
        ],
    ),
    (
        "3. Dang ky tai khoan demo",
        [
            "He thong di toi trang dang ky va nhap thong tin nguoi dung moi.",
            "Tai khoan demo duoc tao truc tiep tren form thuc te cua ung dung.",
            "Ket qua mong doi: dang ky thanh cong, nguoi dung duoc dua vao luong da dang nhap de tiep tuc thao tac.",
        ],
    ),
    (
        "4. Duyet danh sach dich vu",
        [
            "Sau khi dang nhap, video chuyen sang khu vuc dich vu.",
            "Clip the hien viec duyet danh muc, tim kiem va xem nhieu the dich vu tren giao dien.",
            "Phan nay nham cho thay chuc nang business chinh cua he thong, khong chi tap trung vao terminal hay auth.",
        ],
    ),
    (
        "5. Xem chi tiet dich vu va tao lich hen",
        [
            "Nguoi dung mo trang chi tiet cua mot dich vu thuc te.",
            "Sau do clip thuc hien tao booking, chon ngay gio va gui ghi chu demo.",
            "Ket qua mong doi: lich hen duoc tao thanh cong va xuat hien trong khu vuc booking cua tai khoan.",
        ],
    ),
    (
        "6. Cap nhat ho so ca nhan",
        [
            "Clip vao trang ho so va sua thong tin tai khoan demo.",
            "Muc tieu la cho thay user flow co the cap nhat du lieu ca nhan sau khi dang nhap.",
            "Ket qua: ten hien thi duoc doi thanh gia tri moi de xac nhan thay doi da luu.",
        ],
    ),
    (
        "7. Xac minh email",
        [
            "Video di vao trang bao mat tai khoan va demo chuc nang xac minh email.",
            "Token xac minh duoc lay tu outbox noi bo cua backend, sau do dien vao UI that de xac nhan email.",
            "Phan nay chung minh luong verify email hoat dong duoc trong moi truong local.",
        ],
    ),
    (
        "8. Bat 2FA (TOTP)",
        [
            "Clip tao secret 2FA va bat xac thuc hai lop tu trang bao mat.",
            "Ma OTP duoc sinh tu dong tu secret hien tai, nen khong can dien thoai that trong luc demo.",
            "Y nghia cua doan nay la xac nhan he thong co day du luong kich hoat TOTP.",
        ],
    ),
    (
        "9. Doi mat khau",
        [
            "Nguoi dung nhap mat khau cu va mat khau moi hop le tren giao dien.",
            "Sau khi doi mat khau, he thong dang xuat session hien tai va dua ve trang dang nhap.",
            "Clip dung buoc nay de chung minh chuc nang security can thiep vao session nhu ky vong.",
        ],
    ),
    (
        "10. Dang nhap lai bang mat khau moi va OTP",
        [
            "Do 2FA dang bat, clip dang nhap lai bang mat khau moi roi nhap ma OTP dang co hieu luc.",
            "Phan nay la bang chung ro rang rang doi mat khau da thanh cong va 2FA dang duoc ap dung that.",
            "Neu dang nhap thanh cong, giao dien user se tro lai khu vuc da dang nhap.",
        ],
    ),
    (
        "11. Tat 2FA",
        [
            "Sau khi da chung minh luong OTP, clip quay lai trang bao mat de tat 2FA.",
            "Ma OTP moi duoc sinh lai va dung cho thao tac tat 2FA.",
            "Muc dich la dong tron chu trinh bat/tat 2FA va tra tai khoan ve trang thai de su dung on dinh cho cac lan demo sau.",
        ],
    ),
    (
        "12. Dang xuat va chuyen sang luong admin",
        [
            "User dang xuat khoi tai khoan demo.",
            "Sau do admin dang nhap bang tai khoan quan tri co san cua he thong.",
            "Doan nay tach ro quyen user va admin trong cung mot clip demo.",
        ],
    ),
    (
        "13. Admin tim user va xac nhan lich hen",
        [
            "Admin mo khu vuc quan ly nguoi dung, tim tai khoan demo vua tao va kiem tra booking lien quan.",
            "Clip tiep tuc vao man hinh booking/admin de xac nhan lich hen va them ghi chu quan tri.",
            "Phan nay cho thay quy trinh van hanh noi bo sau khi khach hang dat lich.",
        ],
    ),
    (
        "14. Admin xem quan ly dich vu",
        [
            "Video mo trang quan ly dich vu cua admin.",
            "Muc tieu la cho thay backend giao dien quan tri va du lieu quan ly dang hoat dong.",
            "Clip khong di qua CRUD sau hon de giu demo gon, nhung van the hien duoc khu vuc admin chinh.",
        ],
    ),
    (
        "15. User dang nhap lai, xem booking da duoc xac nhan va huy booking",
        [
            "Sau khi admin xac nhan, clip quay lai user va dang nhap lai khong can OTP vi 2FA da tat.",
            "Nguoi dung vao trang lich hen de thay trang thai booking da duoc xac nhan kem ghi chu admin.",
            "Cuoi cung video demo thao tac huy booking de cho thay user co the quan ly lich hen cua chinh minh.",
        ],
    ),
    (
        "16. Ket thuc clip",
        [
            "Clip ket thuc bang thao tac dang xuat, trong khi backend van tiep tuc chay on dinh.",
            "Dieu nay cho thay demo da di het mot vong chuc nang quan trong: public, auth, security, services, booking va admin.",
            "File video la ban quay desktop that cua may, duoc luu trong thu muc demo de dung cho bao cao hoac thuyet trinh.",
        ],
    ),
]


def p(text: str, *, bold: bool = False, size: int | None = None) -> str:
    escaped = escape(text)
    run_props = []
    if bold:
        run_props.append("<w:b/>")
    if size is not None:
        run_props.append(f'<w:sz w:val="{size}"/>')
    props = f"<w:rPr>{''.join(run_props)}</w:rPr>" if run_props else ""
    return (
        "<w:p>"
        "<w:r>"
        f"{props}"
        f"<w:t xml:space=\"preserve\">{escaped}</w:t>"
        "</w:r>"
        "</w:p>"
    )


def document_xml() -> str:
    body = []
    body.append(p("BeautyCare - Giai thich cac phan thao tac trong clip demo", bold=True, size=32))
    body.append(p(f"File video tham chieu: {VIDEO_FILE.name}", bold=True))
    body.append(p("Tai lieu nay tom tat tung doan thao tac chinh xuat hien trong clip demo full desktop quay tren may that."))
    body.append(p(""))

    for title, bullets in SECTIONS:
        body.append(p(title, bold=True, size=26))
        for index, bullet in enumerate(bullets, start=1):
            body.append(p(f"- {bullet}"))
        body.append(p(""))

    body.append(p("Tong ket", bold=True, size=26))
    body.append(
        p(
            "Clip demo tap trung vao cac luong quan trong nhat cua BeautyCare: truy cap public, dang ky/dang nhap, bao mat tai khoan, 2FA, dich vu, dat lich va xu ly admin."
        )
    )
    body.append(
        p(
            "Nhung luong payment provider, membership va mot so CRUD admin sau hon duoc ghi nhan la skip trong demo de giu video gon va on dinh."
        )
    )

    section_props = (
        "<w:sectPr>"
        "<w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
    )

    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        f"{''.join(body)}"
        f"{section_props}"
        "</w:body>"
        "</w:document>"
    )


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""


def rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""


def core_xml() -> str:
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>BeautyCare Demo Explanation</dc:title>
  <dc:subject>Huong dan cac thao tac trong clip demo</dc:subject>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>
"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>OpenAI</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"""


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT_FILE, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml())
        archive.writestr("_rels/.rels", rels_xml())
        archive.writestr("word/document.xml", document_xml())
        archive.writestr("docProps/core.xml", core_xml())
        archive.writestr("docProps/app.xml", app_xml())
    print(f"Created: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
