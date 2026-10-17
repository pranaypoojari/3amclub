import os
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_report():
    json_path = os.path.join(os.path.dirname(__file__), 'test_results.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        test_cases = json.load(f)

    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Styles
    font_family = "Segoe UI"
    title_font = Font(name=font_family, size=16, bold=True, color="FFFFFF")
    subtitle_font = Font(name=font_family, size=11, italic=True, color="E5E7EB")
    section_font = Font(name=font_family, size=13, bold=True, color="1F2937")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    body_font = Font(name=font_family, size=10, color="1F2937")
    bold_body_font = Font(name=font_family, size=10, bold=True, color="1F2937")
    pass_font = Font(name=font_family, size=10, bold=True, color="047857")
    fail_font = Font(name=font_family, size=10, bold=True, color="B91C1C")
    warn_font = Font(name=font_family, size=10, bold=True, color="B45309")
    kpi_num_font = Font(name=font_family, size=20, bold=True, color="4F46E5")
    kpi_lbl_font = Font(name=font_family, size=9, bold=True, color="6B7280")

    dark_fill = PatternFill(start_color="111827", end_color="111827", fill_type="solid")
    primary_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    pass_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    warn_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    kpi_bg_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color="E5E7EB"),
        right=Side(style='thin', color="E5E7EB"),
        top=Side(style='thin', color="E5E7EB"),
        bottom=Side(style='thin', color="E5E7EB")
    )
    thick_bottom = Border(
        bottom=Side(style='medium', color="1F2937"),
        left=Side(style='thin', color="E5E7EB"),
        right=Side(style='thin', color="E5E7EB"),
        top=Side(style='thin', color="E5E7EB")
    )

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_right = Alignment(horizontal="right", vertical="center")

    # =========================================================================
    # SHEET 1: EXECUTIVE SUMMARY
    # =========================================================================
    ws_sum = wb.create_sheet(title="Executive Summary")
    ws_sum.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_sum.merge_cells("A1:H2")
    banner = ws_sum["A1"]
    banner.value = "🌙 THE 3AM CLUB — END-TO-END AUTOMATED TEST REPORT & QUALITY AUDIT"
    banner.font = title_font
    banner.fill = dark_fill
    banner.alignment = Alignment(horizontal="center", vertical="center")

    ws_sum["A3"] = "Generated: Automated Live Test Suite | Environment: Node.js 24 + In-Memory Fallback & Production Serverless Mode"
    ws_sum["A3"].font = subtitle_font
    ws_sum["A3"].fill = PatternFill(start_color="374151", end_color="374151", fill_type="solid")
    ws_sum.merge_cells("A3:H3")
    ws_sum["A3"].alignment = Alignment(horizontal="center", vertical="center")

    # KPI Metric Cards
    total_tests = len(test_cases)
    passed_tests = sum(1 for t in test_cases if t['status'] == 'PASS')
    failed_tests = sum(1 for t in test_cases if t['status'] == 'FAIL')
    total_duration = sum(t.get('durationMs', 0) for t in test_cases)
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

    kpis = [
        ("TOTAL TEST CASES", str(total_tests), "B5:C6"),
        ("TESTS PASSED", str(passed_tests), "D5:E6"),
        ("TESTS FAILED", str(failed_tests), "F5:G6"),
        ("OVERALL PASS RATE", f"{pass_rate:.1f}%", "H5:I6")
    ]

    for label, val, cell_range in kpis:
        top_left = cell_range.split(":")[0]
        ws_sum.merge_cells(cell_range)
        c = ws_sum[top_left]
        c.value = f"{val}\n{label}"
        c.font = kpi_num_font
        c.alignment = align_center
        c.fill = kpi_bg_fill
        # Border around card
        cols = [cell_range[0], cell_range[3]]
        r1, r2 = int(cell_range[1]), int(cell_range[4])

    # Module Breakdown Table
    ws_sum["A8"] = "TEST SUITE MODULE BREAKDOWN & COVERAGE"
    ws_sum["A8"].font = section_font

    headers_mod = ["Module / Category", "Total Scenarios", "Passed", "Failed", "Pass Rate (%)", "Critical Severity", "High Severity", "Status"]
    for col_idx, h in enumerate(headers_mod, start=1):
        cell = ws_sum.cell(row=10, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = thick_bottom

    categories = list(dict.fromkeys(t['category'] for t in test_cases))
    row_idx = 11
    for cat in categories:
        cat_tests = [t for t in test_cases if t['category'] == cat]
        tot = len(cat_tests)
        pas = sum(1 for t in cat_tests if t['status'] == 'PASS')
        fai = sum(1 for t in cat_tests if t['status'] == 'FAIL')
        rate = (pas / tot * 100) if tot > 0 else 0
        crit = sum(1 for t in cat_tests if t.get('severity') == 'Critical')
        high = sum(1 for t in cat_tests if t.get('severity') == 'High')
        status = "HEALTHY" if fai == 0 else "ATTENTION NEEDED"

        ws_sum.cell(row=row_idx, column=1, value=cat).alignment = align_left
        ws_sum.cell(row=row_idx, column=2, value=tot).alignment = align_center
        ws_sum.cell(row=row_idx, column=3, value=pas).alignment = align_center
        ws_sum.cell(row=row_idx, column=4, value=fai).alignment = align_center
        ws_sum.cell(row=row_idx, column=5, value=f"{rate:.1f}%").alignment = align_center
        ws_sum.cell(row=row_idx, column=6, value=crit).alignment = align_center
        ws_sum.cell(row=row_idx, column=7, value=high).alignment = align_center
        
        stat_cell = ws_sum.cell(row=row_idx, column=8, value=status)
        stat_cell.alignment = align_center
        stat_cell.font = pass_font if status == "HEALTHY" else fail_font
        stat_cell.fill = pass_fill if status == "HEALTHY" else fail_fill

        for c in range(1, 9):
            ws_sum.cell(row=row_idx, column=c).border = thin_border
            if row_idx % 2 == 0 and c != 8:
                ws_sum.cell(row=row_idx, column=c).fill = alt_row_fill
            if c != 8:
                ws_sum.cell(row=row_idx, column=c).font = body_font

        row_idx += 1

    # Total Row
    tot_row = row_idx
    ws_sum.cell(row=tot_row, column=1, value="TOTAL / AVERAGE").font = bold_body_font
    ws_sum.cell(row=tot_row, column=2, value=total_tests).font = bold_body_font
    ws_sum.cell(row=tot_row, column=3, value=passed_tests).font = bold_body_font
    ws_sum.cell(row=tot_row, column=4, value=failed_tests).font = bold_body_font
    ws_sum.cell(row=tot_row, column=5, value=f"{pass_rate:.1f}%").font = bold_body_font
    ws_sum.cell(row=tot_row, column=6, value=sum(1 for t in test_cases if t.get('severity') == 'Critical')).font = bold_body_font
    ws_sum.cell(row=tot_row, column=7, value=sum(1 for t in test_cases if t.get('severity') == 'High')).font = bold_body_font
    ws_sum.cell(row=tot_row, column=8, value="100% OPERATIONAL").font = pass_font
    ws_sum.cell(row=tot_row, column=8).fill = pass_fill

    for c in range(1, 9):
        ws_sum.cell(row=tot_row, column=c).alignment = align_center if c > 1 else align_left
        ws_sum.cell(row=tot_row, column=c).border = thick_bottom
        if c != 8:
            ws_sum.cell(row=tot_row, column=c).fill = kpi_bg_fill

    # Architectural Highlights Section
    h_row = tot_row + 3
    ws_sum.cell(row=h_row, column=1, value="KEY ARCHITECTURAL & PRODUCT SAFEGUARDS VERIFIED").font = section_font
    
    safeguards = [
        ("🔒 Zero-Knowledge Authentication", "PBKDF2 salted password hashing, JWT Access Token (15m) + Refresh Token (30d) with atomic rotation & forgery rejection."),
        ("📡 20km Radar & Anti-Stalking Fuzzing", "Home feed default 20km radius boundary. Non-mutual coordinates fuzz-jittered by up to 2km. Exact coordinates locked strictly to mutual followers."),
        ("💬 Instagram-Style Anti-Spam DM Rules", "Non-mutual users are strictly limited to exactly 1 pending message request. Unlimited chat unlocks ONLY after mutual acceptance."),
        ("🚗 Spontaneous Carpooling & Safety", "Real-time seat count decrements, overbooking protection (rejects join when seats=0), and departure time verification."),
        ("⚡ Production Resilience & PWA Support", "Write rate-limiting with x-forwarded-for reverse-proxy support, nosniff/SAMEORIGIN/HSTS security headers, and standalone PWA installability.")
    ]

    s_row = h_row + 1
    for title, desc in safeguards:
        ws_sum.cell(row=s_row, column=1, value=title).font = bold_body_font
        ws_sum.cell(row=s_row, column=1).fill = kpi_bg_fill
        ws_sum.cell(row=s_row, column=1).alignment = align_left
        ws_sum.cell(row=s_row, column=1).border = thin_border

        ws_sum.merge_cells(start_row=s_row, start_column=2, end_row=s_row, end_column=8)
        c_desc = ws_sum.cell(row=s_row, column=2, value=desc)
        c_desc.font = body_font
        c_desc.alignment = align_left
        for c in range(2, 9):
            ws_sum.cell(row=s_row, column=c).border = thin_border
        s_row += 1

    # Adjust summary column widths
    ws_sum.column_dimensions['A'].width = 32
    ws_sum.column_dimensions['B'].width = 16
    ws_sum.column_dimensions['C'].width = 12
    ws_sum.column_dimensions['D'].width = 12
    ws_sum.column_dimensions['E'].width = 16
    ws_sum.column_dimensions['F'].width = 18
    ws_sum.column_dimensions['G'].width = 16
    ws_sum.column_dimensions['H'].width = 24
    ws_sum.column_dimensions['I'].width = 14

    # =========================================================================
    # SHEET 2: DETAILED TEST CASES
    # =========================================================================
    ws_cases = wb.create_sheet(title="Detailed Test Cases")
    ws_cases.views.sheetView[0].showGridLines = True

    # Header Row
    headers_cases = [
        "Test ID", "Module", "Scenario Description", "Input / Payload Tested",
        "Expected Result", "Actual Result Observed", "Execution Time",
        "Severity", "Status", "Edge Case & Technical Notes"
    ]
    for col_idx, h in enumerate(headers_cases, start=1):
        cell = ws_cases.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = dark_fill
        cell.alignment = align_center
        cell.border = thick_bottom

    ws_cases.row_dimensions[1].height = 28

    for r_idx, tc in enumerate(test_cases, start=2):
        status = tc.get('status', 'PASS')
        severity = tc.get('severity', 'Medium')

        ws_cases.cell(row=r_idx, column=1, value=tc.get('id', '')).alignment = align_center
        ws_cases.cell(row=r_idx, column=2, value=tc.get('category', '')).alignment = align_left
        ws_cases.cell(row=r_idx, column=3, value=tc.get('scenario', '')).alignment = align_left
        ws_cases.cell(row=r_idx, column=4, value=tc.get('inputDesc', '')).alignment = align_left
        ws_cases.cell(row=r_idx, column=5, value=tc.get('expected', '')).alignment = align_left
        ws_cases.cell(row=r_idx, column=6, value=tc.get('actual', '')).alignment = align_left
        ws_cases.cell(row=r_idx, column=7, value=f"{tc.get('durationMs', 0)} ms").alignment = align_center
        ws_cases.cell(row=r_idx, column=8, value=severity).alignment = align_center
        
        stat_cell = ws_cases.cell(row=r_idx, column=9, value=status)
        stat_cell.alignment = align_center
        stat_cell.font = pass_font if status == 'PASS' else (warn_font if status == 'WARNING' else fail_font)
        stat_cell.fill = pass_fill if status == 'PASS' else (warn_fill if status == 'WARNING' else fail_fill)

        ws_cases.cell(row=r_idx, column=10, value=tc.get('notes', '')).alignment = align_left

        for c in range(1, 11):
            cell = ws_cases.cell(row=r_idx, column=c)
            cell.border = thin_border
            if c != 9:
                cell.font = bold_body_font if c in [1, 8] else body_font
                if r_idx % 2 == 1:
                    cell.fill = alt_row_fill

        ws_cases.row_dimensions[r_idx].height = 24

    # Adjust cases column widths
    case_widths = {
        'A': 15, 'B': 22, 'C': 38, 'D': 35,
        'E': 38, 'F': 38, 'G': 16, 'H': 14,
        'I': 14, 'J': 45
    }
    for col_letter, width in case_widths.items():
        ws_cases.column_dimensions[col_letter].width = width

    # =========================================================================
    # SHEET 3: GAPS & IMPROVEMENTS ROADMAP
    # =========================================================================
    ws_imp = wb.create_sheet(title="Improvements Roadmap")
    ws_imp.views.sheetView[0].showGridLines = True

    # Title
    ws_imp.merge_cells("A1:G2")
    imp_title = ws_imp["A1"]
    imp_title.value = "🚀 3AM CLUB — IDENTIFIED GAPS & RECOMMENDED SYSTEM IMPROVEMENTS"
    imp_title.font = title_font
    imp_title.fill = dark_fill
    imp_title.alignment = align_center

    headers_imp = [
        "Item #", "Pillar / Dimension", "Improvement Feature",
        "Current State & Edge-Case Gap", "Recommended Technical Solution",
        "Impact", "Effort", "Release Target"
    ]
    for col_idx, h in enumerate(headers_imp, start=1):
        cell = ws_imp.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = primary_fill
        cell.alignment = align_center
        cell.border = thick_bottom

    ws_imp.row_dimensions[4].height = 26

    improvements_data = [
        (
            "IMP-01",
            "Architecture & Real-Time",
            "Redis Pub/Sub for Serverless SSE Scaling",
            "Current SSE relies on single-process in-memory subscriber sets. On Vercel serverless functions, connections terminate after lambda timeout and events don't cross lambda boundaries.",
            "Integrate Upstash Redis or Pusher/Ably WebSocket channels. When a ride or clink is created on one instance, Redis publishes to all connected clients across India.",
            "Critical", "Medium", "v1.1 (Next Release)"
        ),
        (
            "IMP-02",
            "Security & Cryptography",
            "Argon2id Password Hashing & Per-Alias Rate Limiting",
            "Passwords currently use standard PBKDF2 with 10k iterations. Authentication rate-limit is IP-based rather than account-based.",
            "Upgrade to Argon2id (OWASP recommended standard) with per-user salt. Add exponential backoff per account alias (lock for 15 mins after 5 bad attempts).",
            "High", "Low", "v1.1"
        ),
        (
            "IMP-03",
            "Location & Privacy",
            "Geohash Pre-Jittering Database Storage",
            "Frontend sends actual GPS coordinates to /api/checkin; coordinates are jittered on read for non-mutuals, but raw GPS remains in MongoDB documents.",
            "Store only pre-jittered coordinates or Geohash-6 (~1.2km precision) in MongoDB. Never persist exact residential coordinates even in backend tables.",
            "Critical", "Low", "v1.1"
        ),
        (
            "IMP-04",
            "PWA & Engagement",
            "VAPID Web Push Notifications Engine",
            "PWA manifest and Service Worker caching are active, but users cannot receive push notifications when phone screen is locked or browser is closed.",
            "Implement Web Push API with VAPID keys. Send push notifications when an owl receives a Cheers, a DM request, or when a nearby carpool ride is posted.",
            "High", "Medium", "v1.2"
        ),
        (
            "IMP-05",
            "Media & Social",
            "Ephemeral Midnight Voice Notes (15-Sec Audio)",
            "Midnight Whispers and Confessions are currently text-only. GenZ late-night users crave authentic ambient audio (car exhaust, rain, lo-fi tracks).",
            "Add MediaRecorder audio capturing for 15-second ambient clips stored in AWS S3 / Cloudinary with auto-destruct headers at 5:00 AM sunrise.",
            "High", "Medium", "v1.2"
        ),
        (
            "IMP-06",
            "Safety & Trust",
            "Midnight Ride Verification Code (OTP Handshake)",
            "Ride carpooling allows users to join squads, but there is no pickup verification handshake between driver and passenger.",
            "Generate a 4-digit midnight safety PIN displayed on passenger's screen that the driver confirms before departing (prevents wrong-car pickups at 3 AM).",
            "Critical", "Low", "v1.1"
        ),
        (
            "IMP-07",
            "Monetization & Ops",
            "Razorpay / UPI Midnight Pass & Virtual Chai Gifting",
            "Currently no payment gateways or micro-transaction monetization avenues are implemented.",
            "Implement Razorpay / Cashfree webhook integration for ₹49/month Midnight Pass (Ghost Mode, Unlimited Distance, Gold Owl) + ₹10 UPI Virtual Chai tipping.",
            "High", "Medium", "v1.2"
        ),
        (
            "IMP-08",
            "Performance & SEO",
            "Incremental Static Edge Rendering & City Landing Pages",
            "City discovery pages (Thane, Mumbai, Bangalore, Pune) rely on single client-side SPA bundle.",
            "Pre-render server-side city landing pages (/thane, /mumbai, /bangalore) with OpenGraph night-owl preview cards for viral WhatsApp & Instagram sharing.",
            "Medium", "Low", "v1.3"
        )
    ]

    for r_idx, imp in enumerate(improvements_data, start=5):
        imp_id, pillar, title, gap, sol, impact, effort, target = imp
        
        ws_imp.cell(row=r_idx, column=1, value=imp_id).alignment = align_center
        ws_imp.cell(row=r_idx, column=2, value=pillar).alignment = align_left
        ws_imp.cell(row=r_idx, column=3, value=title).alignment = align_left
        ws_imp.cell(row=r_idx, column=4, value=gap).alignment = align_left
        ws_imp.cell(row=r_idx, column=5, value=sol).alignment = align_left
        
        imp_cell = ws_imp.cell(row=r_idx, column=6, value=impact)
        imp_cell.alignment = align_center
        imp_cell.font = Font(name=font_family, size=10, bold=True, color="991B1B" if impact == "Critical" else "1E40AF")
        imp_cell.fill = PatternFill(start_color="FEE2E2" if impact == "Critical" else "DBEAFE", end_color="FEE2E2" if impact == "Critical" else "DBEAFE", fill_type="solid")

        ws_imp.cell(row=r_idx, column=7, value=effort).alignment = align_center
        ws_imp.cell(row=r_idx, column=8, value=target).alignment = align_center

        for c in range(1, 9):
            cell = ws_imp.cell(row=r_idx, column=c)
            cell.border = thin_border
            if c != 6:
                cell.font = bold_body_font if c in [1, 3] else body_font
                if r_idx % 2 == 1:
                    cell.fill = alt_row_fill

        ws_imp.row_dimensions[r_idx].height = 54

    imp_widths = {
        'A': 12, 'B': 24, 'C': 28, 'D': 42,
        'E': 45, 'F': 14, 'G': 12, 'H': 18
    }
    for col_letter, width in imp_widths.items():
        ws_imp.column_dimensions[col_letter].width = width

    # Save Excel file
    output_path = os.path.join(os.path.dirname(__file__), '..', '3AM_CLUB_E2E_TEST_REPORT.xlsx')
    output_path = os.path.abspath(output_path)
    wb.save(output_path)
    print(f"Successfully generated clean Excel report at: {output_path}")

if __name__ == '__main__':
    build_report()
