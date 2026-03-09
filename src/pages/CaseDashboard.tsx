import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Download, Loader2, Edit, Save, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, FileText, ChevronDown, QrCode, Copy, Link2 } from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import QRCode from "qrcode";

interface CaseData {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_mobile: string;
  customer_email: string;
  machine_condition: string;
  lubricant_condition: string;
  recommendations: string;
  created_at: string;
  access_token: string;
  sample_id: string;
  lubricant_grade: string;
  equipment_id: string;
  sampling_point: string;
  ulr_number: string;
  sample_receipt_date: string;
  sample_testing_date: string;
  report_date: string;
}

interface TestData {
  id: string;
  test_name: string;
  image_url: string;
  image_comment: string;
  created_at: string;
  results: TestResult[];
}

interface TestResult {
  id: string;
  parameter_name: string;
  lower_limit: number;
  upper_limit: number;
  actual_value: number;
  unit: string;
  particle_size: string;
  status: string;
  test_method: string;
}

interface CompanySettings {
  company_name: string;
  logo_url: string;
  contact_number: string;
  email: string;
  address: string;
}

const COLORS = {
  NORMAL: "#22c55e",
  ALERT: "#f59e0b",
  ALARM: "#ef4444",
  primary: "#0ea5e9",
  secondary: "#06b6d4",
};

const CaseDashboard = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [tests, setTests] = useState<TestData[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingRecommendations, setEditingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const getPublicReportUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/report/${caseData?.access_token}`;
  };

  const generateQrCode = async (token: string) => {
    try {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/report/${token}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 150,
        margin: 2,
        color: {
          dark: '#0284c7',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  const copyCustomerLink = () => {
    const url = getPublicReportUrl();
    navigator.clipboard.writeText(url);
    toast.success("Customer access link copied to clipboard!");
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  const fetchData = async () => {
    const { data: caseInfo, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError) {
      console.error("Error fetching case:", caseError);
      toast.error("Failed to load case data");
      return;
    }

    setCaseData(caseInfo as CaseData);
    setRecommendations(caseInfo.recommendations || "");
    
    // Generate QR code for customer access
    if (caseInfo.access_token) {
      generateQrCode(caseInfo.access_token);
    }

    const { data: testsData, error: testsError } = await supabase
      .from("case_tests")
      .select(`
        id,
        test_name,
        image_url,
        image_comment,
        created_at,
        case_test_results (
          id,
          parameter_name,
          lower_limit,
          upper_limit,
          actual_value,
          unit,
          particle_size,
          status,
          test_method
        )
      `)
      .eq("case_id", caseId);

    if (testsError) {
      console.error("Error fetching tests:", testsError);
    } else {
      const formattedTests = testsData.map((test: any) => ({
        id: test.id,
        test_name: test.test_name,
        image_url: test.image_url,
        image_comment: test.image_comment || "",
        created_at: test.created_at,
        results: test.case_test_results || [],
      }));
      setTests(formattedTests);
    }

    const { data: settings } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (settings) {
      setCompanySettings(settings);
    }

    setLoading(false);
  };

  const saveRecommendations = async () => {
    const { error } = await supabase
      .from("cases")
      .update({ recommendations })
      .eq("id", caseId);

    if (error) {
      toast.error("Failed to save recommendations");
    } else {
      toast.success("Recommendations saved!");
      setEditingRecommendations(false);
      if (caseData) {
        setCaseData({ ...caseData, recommendations });
      }
    }
  };

  const getConditionInfo = (machineCondition: string, lubricantCondition: string) => {
    const conditions = [machineCondition, lubricantCondition];
    if (conditions.includes("ALARM")) {
      return {
        label: "ALARM",
        color: COLORS.ALARM,
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        icon: XCircle,
        message: "Critical condition detected. Immediate action required. Equipment may be at risk of failure.",
      };
    }
    if (conditions.includes("ALERT")) {
      return {
        label: "ALERT",
        color: COLORS.ALERT,
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        icon: AlertTriangle,
        message: "Some parameters are outside normal limits. Monitor closely and consider corrective action.",
      };
    }
    return {
      label: "NORMAL",
      color: COLORS.NORMAL,
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      icon: CheckCircle,
      message: "The lubricant and machine condition are normal. All parameters are within acceptable limits. No immediate action required. Continue routine monitoring.",
    };
  };

  // Convert external image to base64 using canvas approach
  const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Canvas conversion failed:', err);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.error('Image failed to load:', imageUrl);
        resolve(null);
      };
      
      // Add cache buster to avoid CORS cache issues
      img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  };

  const generatePDF = async () => {
    if (!dashboardRef.current) return;

    setGenerating(true);
    toast.info("Generating PDF... Converting images...");

    try {
      // Hide no-print elements
      const noPrintElements = dashboardRef.current.querySelectorAll('.no-print');
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

     // Force desktop layout for PDF - set fixed width to ensure 3-column grid
     const originalStyle = dashboardRef.current.getAttribute('style') || '';
     dashboardRef.current.style.width = '1200px';
     dashboardRef.current.style.maxWidth = '1200px';
     dashboardRef.current.style.minWidth = '1200px';

     // Force grid items to be in 3 columns
     const gridElements = dashboardRef.current.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3');
     gridElements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = 'repeat(3, 1fr)';
     });

     // Force 2-column grids
     const grid2Elements = dashboardRef.current.querySelectorAll('.grid.grid-cols-2');
     grid2Elements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = 'repeat(2, 1fr)';
     });

     // Force 4-column grids for client info
     const grid4Elements = dashboardRef.current.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4');
     grid4Elements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = 'repeat(4, 1fr)';
     });

      // Pre-convert all external images to base64
      const images = dashboardRef.current.querySelectorAll('img');
      const originalSrcs = new Map<HTMLImageElement, string>();
      
      for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
          originalSrcs.set(img, img.src);
          const base64 = await convertImageToBase64(img.src);
          if (base64) {
            img.src = base64;
          } else {
            // Hide images that can't be converted to avoid blank space
            img.style.display = 'none';
          }
        }
      }

      // Wait for images to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      const sections = dashboardRef.current.querySelectorAll(".pdf-section");
      let yPosition = margin;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        
        const canvas = await html2canvas(section, {
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
         windowWidth: 1200,
         width: 1200,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (yPosition + imgHeight > pageHeight - margin && i > 0) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 5;

        if (imgHeight > pageHeight / 2) {
          pdf.addPage();
          yPosition = margin;
        }
      }

      // Restore original image sources and visibility
      for (const [img, src] of originalSrcs) {
        img.src = src;
        img.style.display = '';
      }

     // Restore grid layouts
     gridElements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = '';
     });
     grid2Elements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = '';
     });
     grid4Elements.forEach((el) => {
       (el as HTMLElement).style.gridTemplateColumns = '';
     });

     // Restore original container style
     dashboardRef.current.setAttribute('style', originalStyle);

      // Restore no-print elements
      noPrintElements.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });

      pdf.save(`oil-analysis-${caseData?.customer_name}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }

    setGenerating(false);
  };

  const generateExcel = async () => {
    if (!caseData) return;
    setGenerating(true);
    toast.info("Generating Excel report...");

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = companySettings?.company_name || "Oil Analysis Lab";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Oil Analysis Report");

      // Set column widths
      sheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 20 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
      ];

      // Header
      sheet.mergeCells("A1:G1");
      const headerCell = sheet.getCell("A1");
      headerCell.value = companySettings?.company_name || "Oil Analysis Lab";
      headerCell.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
      headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
      headerCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 35;

      sheet.mergeCells("A2:G2");
      const titleCell = sheet.getCell("A2");
      titleCell.value = "Comprehensive Oil Analysis Report";
      titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0891B2" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(2).height = 28;

      // Client Info
      let row = 4;
      const addInfoRow = (label: string, value: string) => {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.mergeCells(`B${row}:D${row}`);
        sheet.getCell(`B${row}`).value = value;
        row++;
      };

      addInfoRow("CLIENT:", caseData.customer_name);
      if (caseData.customer_email) addInfoRow("EMAIL:", caseData.customer_email);
      if (caseData.customer_mobile) addInfoRow("MOBILE:", caseData.customer_mobile);
      if (caseData.customer_address) addInfoRow("ADDRESS:", caseData.customer_address);
      addInfoRow("REPORT DATE:", format(new Date(), "MMM d, yyyy"));
      addInfoRow("SAMPLE DATE:", format(new Date(caseData.created_at), "MMM d, yyyy"));

      row += 1;

      // Executive Summary
      sheet.mergeCells(`A${row}:G${row}`);
      const summaryHeader = sheet.getCell(`A${row}`);
      summaryHeader.value = "EXECUTIVE SUMMARY";
      summaryHeader.font = { bold: true, size: 12 };
      summaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      row++;

      const condInfo = getConditionInfo(caseData.machine_condition, caseData.lubricant_condition);
      addInfoRow("Overall Status:", condInfo.label);
      addInfoRow("Machine Condition:", caseData.machine_condition);
      addInfoRow("Lubricant Condition:", caseData.lubricant_condition);
      sheet.mergeCells(`A${row}:G${row}`);
      sheet.getCell(`A${row}`).value = condInfo.message;
      sheet.getCell(`A${row}`).alignment = { wrapText: true };
      sheet.getRow(row).height = 40;
      row += 2;

      // Status Summary
      sheet.mergeCells(`A${row}:G${row}`);
      const statusHeader = sheet.getCell(`A${row}`);
      statusHeader.value = "STATUS SUMMARY";
      statusHeader.font = { bold: true, size: 12 };
      statusHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      row++;

      const allResults = tests.flatMap((test) => test.results);
      const statusCounts = {
        NORMAL: allResults.filter((r) => r.status === "NORMAL").length,
        ALERT: allResults.filter((r) => r.status === "ALERT").length,
        ALARM: allResults.filter((r) => r.status === "ALARM").length,
      };

      addInfoRow("Normal Parameters:", statusCounts.NORMAL.toString());
      addInfoRow("Alert Parameters:", statusCounts.ALERT.toString());
      addInfoRow("Alarm Parameters:", statusCounts.ALARM.toString());
      row++;

      // Test Results
      for (const test of tests) {
        sheet.mergeCells(`A${row}:G${row}`);
        const testHeader = sheet.getCell(`A${row}`);
        testHeader.value = `TEST RESULTS - ${test.test_name.toUpperCase()}`;
        testHeader.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        testHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
        row++;

        // Table headers
        const headers = ["TEST PARAMETER", "LOWER LIMIT", "UPPER LIMIT", "ACTUAL VALUE", "UNIT", "PARTICLE SIZE", "STATUS"];
        headers.forEach((header, i) => {
          const cell = sheet.getCell(row, i + 1);
          cell.value = header;
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
          cell.alignment = { horizontal: "center" };
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        row++;

        // Table data
        for (const result of test.results) {
          const values = [
            result.parameter_name,
            result.lower_limit?.toString() || "-",
            result.upper_limit?.toString() || "-",
            result.actual_value.toString(),
            result.unit || "-",
            result.particle_size || "-",
            result.status,
          ];
          values.forEach((val, i) => {
            const cell = sheet.getCell(row, i + 1);
            cell.value = val;
            cell.alignment = { horizontal: "center" };
            cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
            
            // Color status column
            if (i === 6) {
              if (val === "NORMAL") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } };
              else if (val === "ALERT") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
              else if (val === "ALARM") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEF4444" } };
              cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            }
          });
          row++;
        }

        if (test.image_comment) {
          sheet.mergeCells(`A${row}:G${row}`);
          sheet.getCell(`A${row}`).value = `Image Comment: ${test.image_comment}`;
          sheet.getCell(`A${row}`).font = { italic: true };
          row++;
        }
        row++;
      }

      // Recommendations
      sheet.mergeCells(`A${row}:G${row}`);
      const recHeader = sheet.getCell(`A${row}`);
      recHeader.value = "DATA INTERPRETATION & RECOMMENDATIONS";
      recHeader.font = { bold: true, size: 12 };
      recHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      row++;

      sheet.mergeCells(`A${row}:G${row + 3}`);
      const recCell = sheet.getCell(`A${row}`);
      recCell.value = caseData.recommendations || "No recommendations added yet.";
      recCell.alignment = { wrapText: true, vertical: "top" };
      row += 5;

      // Footer
      sheet.mergeCells(`A${row}:G${row}`);
      const footerCell = sheet.getCell(`A${row}`);
      footerCell.value = `${companySettings?.company_name || "Oil Analysis Lab"} | ${companySettings?.address || ""} | ${companySettings?.contact_number || ""} | ${companySettings?.email || ""}`;
      footerCell.alignment = { horizontal: "center" };
      footerCell.font = { size: 10, color: { argb: "FF64748B" } };

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `oil-analysis-${caseData.customer_name}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel report generated successfully!");
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Failed to generate Excel report");
    }

    setGenerating(false);
  };

  const generateWord = async () => {
    if (!caseData) return;
    setGenerating(true);
    toast.info("Generating Word document...");

    try {
      const condInfo = getConditionInfo(caseData.machine_condition, caseData.lubricant_condition);
      const allResults = tests.flatMap((test) => test.results);
      const statusCounts = {
        NORMAL: allResults.filter((r) => r.status === "NORMAL").length,
        ALERT: allResults.filter((r) => r.status === "ALERT").length,
        ALARM: allResults.filter((r) => r.status === "ALARM").length,
      };

      const children: any[] = [];

      // Header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: companySettings?.company_name || "Oil Analysis Lab",
              bold: true,
              size: 36,
              color: "0284C7",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Comprehensive Oil Analysis Report",
              bold: true,
              size: 28,
              color: "0891B2",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Client Info
      const infoItems = [
        { label: "CLIENT:", value: caseData.customer_name },
        ...(caseData.customer_email ? [{ label: "EMAIL:", value: caseData.customer_email }] : []),
        ...(caseData.customer_mobile ? [{ label: "MOBILE:", value: caseData.customer_mobile }] : []),
        { label: "REPORT DATE:", value: format(new Date(), "MMM d, yyyy") },
        { label: "SAMPLE DATE:", value: format(new Date(caseData.created_at), "MMM d, yyyy") },
      ];

      infoItems.forEach(({ label, value }) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: label + " ", bold: true }),
              new TextRun({ text: value }),
            ],
            spacing: { after: 100 },
          })
        );
      });

      // Executive Summary
      children.push(
        new Paragraph({
          text: "EXECUTIVE SUMMARY",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Overall Status: ", bold: true }),
            new TextRun({
              text: condInfo.label,
              bold: true,
              color: condInfo.label === "NORMAL" ? "22C55E" : condInfo.label === "ALERT" ? "F59E0B" : "EF4444",
            }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Machine Condition: ", bold: true }),
            new TextRun({ text: caseData.machine_condition }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Lubricant Condition: ", bold: true }),
            new TextRun({ text: caseData.lubricant_condition }),
          ],
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: condInfo.message,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Normal: ${statusCounts.NORMAL} | Alert: ${statusCounts.ALERT} | Alarm: ${statusCounts.ALARM}`, italics: true }),
          ],
          spacing: { after: 400 },
        })
      );

      // Test Results
      for (const test of tests) {
        children.push(
          new Paragraph({
            text: `TEST RESULTS - ${test.test_name.toUpperCase()}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        const hasParticleSize = test.results.some((r) => r.particle_size);
        const headers = ["Parameter", "Lower", "Upper", "Actual", "Unit", ...(hasParticleSize ? ["Particle Size"] : []), "Status"];

        const tableRows = [
          new TableRow({
            children: headers.map((h) =>
              new TableCell({
                children: [new Paragraph({ text: h, alignment: AlignmentType.CENTER })],
                shading: { fill: "0284C7" },
                width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
              })
            ),
          }),
          ...test.results.map(
            (result) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: result.parameter_name, alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: result.lower_limit?.toString() || "-", alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: result.upper_limit?.toString() || "-", alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: result.actual_value.toString(), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: result.unit || "-", alignment: AlignmentType.CENTER })] }),
                  ...(hasParticleSize ? [new TableCell({ children: [new Paragraph({ text: result.particle_size || "-", alignment: AlignmentType.CENTER })] })] : []),
                  new TableCell({
                    children: [new Paragraph({ text: result.status, alignment: AlignmentType.CENTER })],
                    shading: {
                      fill: result.status === "NORMAL" ? "22C55E" : result.status === "ALERT" ? "F59E0B" : "EF4444",
                    },
                  }),
                ],
              })
          ),
        ];

        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );

        if (test.image_comment) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Image Comment: ", bold: true }),
                new TextRun({ text: test.image_comment, italics: true }),
              ],
              spacing: { before: 200, after: 200 },
            })
          );
        }
      }

      // Recommendations
      children.push(
        new Paragraph({
          text: "DATA INTERPRETATION & RECOMMENDATIONS",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: caseData.recommendations || "No recommendations added yet.",
          spacing: { after: 400 },
        })
      );

      // Footer
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${companySettings?.company_name || "Oil Analysis Lab"} | ${companySettings?.address || ""} | ${companySettings?.contact_number || ""} | ${companySettings?.email || ""}`,
              size: 18,
              color: "64748B",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        })
      );

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `oil-analysis-${caseData.customer_name}-${format(new Date(), "yyyy-MM-dd")}.docx`);
      toast.success("Word document generated successfully!");
    } catch (error) {
      console.error("Error generating Word:", error);
      toast.error("Failed to generate Word document");
    }

    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Case not found</p>
      </div>
    );
  }

  const allResults = tests.flatMap((test) => test.results);
  const statusCounts = {
    NORMAL: allResults.filter((r) => r.status === "NORMAL").length,
    ALERT: allResults.filter((r) => r.status === "ALERT").length,
    ALARM: allResults.filter((r) => r.status === "ALARM").length,
  };

  const pieData = [
    { name: "NORMAL", value: statusCounts.NORMAL, fill: COLORS.NORMAL },
    { name: "ALERT", value: statusCounts.ALERT, fill: COLORS.ALERT },
    { name: "ALARM", value: statusCounts.ALARM, fill: COLORS.ALARM },
  ].filter((d) => d.value > 0);

  const conditionInfo = getConditionInfo(caseData.machine_condition, caseData.lubricant_condition);
  const ConditionIcon = conditionInfo.icon;

  const barChartData = allResults.slice(0, 6).map((r) => ({
    name: r.parameter_name.length > 10 ? r.parameter_name.substring(0, 10) + "..." : r.parameter_name,
    value: r.actual_value,
    fill: r.status === "NORMAL" ? COLORS.primary : r.status === "ALERT" ? COLORS.ALERT : COLORS.ALARM,
  }));

  const radialData = [
    { name: "Normal", value: statusCounts.NORMAL, fill: COLORS.NORMAL },
    { name: "Alert", value: statusCounts.ALERT, fill: COLORS.ALERT },
    { name: "Alarm", value: statusCounts.ALARM, fill: COLORS.ALARM },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/case/${caseId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Case
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/case/${caseId}/manage-tests`}>
                <FlaskConical className="mr-2 h-4 w-4" />
                Manage Tests
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/case/${caseId}/add-test`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Test
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={generating} className="bg-sky-600 hover:bg-sky-700">
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={generatePDF} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={generateExcel} className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={generateWord} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Export as Word
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div ref={dashboardRef} className="container mx-auto px-4 py-6 space-y-6">
        <div className="pdf-section bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {companySettings?.logo_url && (
                <img src={companySettings.logo_url} alt="Logo" className="h-12 bg-white rounded p-1" />
              )}
              <div className="text-white">
                <h1 className="text-xl font-bold">{companySettings?.company_name || "Oil Analysis Lab"}</h1>
                {companySettings?.address && <p className="text-sm text-sky-100">{companySettings.address}</p>}
              </div>
            </div>
            <div className="text-right text-white">
              <h2 className="text-2xl font-bold">Comprehensive</h2>
              <h2 className="text-2xl font-bold">Oil Analysis Report</h2>
            </div>
          </div>
          
          <div className="bg-slate-100 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="font-semibold">CLIENT:</span> {caseData.customer_name}</div>
            {caseData.customer_address && <div><span className="font-semibold">ADDRESS:</span> {caseData.customer_address}</div>}
            {caseData.customer_mobile && <div><span className="font-semibold">CONTACT:</span> {caseData.customer_mobile}</div>}
            {(caseData as any).sample_id && <div><span className="font-semibold">SAMPLE ID:</span> {(caseData as any).sample_id}</div>}
            {(caseData as any).lubricant_grade && <div><span className="font-semibold">LUBRICANT GRADE:</span> {(caseData as any).lubricant_grade}</div>}
            {(caseData as any).equipment_id && <div><span className="font-semibold">EQUIPMENT ID:</span> {(caseData as any).equipment_id}</div>}
            {(caseData as any).sampling_point && <div><span className="font-semibold">SAMPLING POINT:</span> {(caseData as any).sampling_point}</div>}
            {(caseData as any).ulr_number && <div><span className="font-semibold">ULR NUMBER:</span> {(caseData as any).ulr_number}</div>}
            {(caseData as any).sample_receipt_date && <div><span className="font-semibold">SAMPLE RECEIPT:</span> {format(new Date((caseData as any).sample_receipt_date), "MMM d, yyyy")}</div>}
            {(caseData as any).sample_testing_date && <div><span className="font-semibold">TESTING DATE:</span> {format(new Date((caseData as any).sample_testing_date), "MMM d, yyyy")}</div>}
            <div><span className="font-semibold">REPORT DATE:</span> {(caseData as any).report_date ? format(new Date((caseData as any).report_date), "MMM d, yyyy") : format(new Date(), "MMM d, yyyy")}</div>
          </div>
        </div>

        <div className="pdf-section bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-sky-500 rounded"></div>
            EXECUTIVE SUMMARY
          </h3>
          <div className={`p-4 rounded-lg ${conditionInfo.bgColor}`}>
            <div className="flex items-center gap-4 mb-2">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: conditionInfo.color }}
              >
                <ConditionIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h4 className={`text-2xl font-bold leading-tight ${conditionInfo.textColor}`}>
                  {conditionInfo.label}
                </h4>
                <p className="text-sm text-slate-600 leading-tight">CONDITION</p>
              </div>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{conditionInfo.message}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-2 leading-tight">Machine Condition</p>
              <span className={`inline-block text-sm font-semibold px-3 py-1 rounded ${
                caseData.machine_condition === "NORMAL" ? "bg-green-500" :
                caseData.machine_condition === "ALERT" ? "bg-amber-500" : "bg-red-500"
              } text-white`}>
                {caseData.machine_condition}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-2 leading-tight">Lubricant Condition</p>
              <span className={`inline-block text-sm font-semibold px-3 py-1 rounded ${
                caseData.lubricant_condition === "NORMAL" ? "bg-green-500" :
                caseData.lubricant_condition === "ALERT" ? "bg-amber-500" : "bg-red-500"
              } text-white`}>
                {caseData.lubricant_condition}
              </span>
            </div>
          </div>
        </div>

        <div className="pdf-section bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-sky-500 rounded"></div>
            DATA DASHBOARD
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">PARAMETER VALUES</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">STATUS DISTRIBUTION</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">STATUS OVERVIEW</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="30%"
                    outerRadius="100%"
                    barSize={15}
                    data={radialData}
                  >
                    <RadialBar background dataKey="value" />
                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {tests.map((test) => (
          <div key={test.id} className="pdf-section bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-sky-500 rounded"></div>
                TEST RESULTS - {test.test_name.toUpperCase()}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/case/${caseId}/test/${test.id}/edit`)}
                className="no-print"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-600 text-white">
                    <th className="text-center p-3 font-semibold rounded-tl-lg">TEST PARAMETER</th>
                    <th className="text-center p-3 font-semibold">TEST METHOD</th>
                    <th className="text-center p-3 font-semibold">LOWER LIMIT</th>
                    <th className="text-center p-3 font-semibold">UPPER LIMIT</th>
                    <th className="text-center p-3 font-semibold">ACTUAL VALUE</th>
                    <th className="text-center p-3 font-semibold">UNIT</th>
                    {test.results.some((r) => r.particle_size) && (
                      <th className="text-center p-3 font-semibold">PARTICLE SIZE</th>
                    )}
                    <th className="text-center p-3 font-semibold rounded-tr-lg">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {test.results.map((result, idx) => (
                    <tr key={result.id} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                      <td className="p-3 text-center font-medium text-slate-700">{result.parameter_name}</td>
                      <td className="p-3 text-center text-slate-600">{(result as any).test_method || "-"}</td>
                      <td className="p-3 text-center text-slate-600">{result.lower_limit || "-"}</td>
                      <td className="p-3 text-center text-slate-600">{result.upper_limit || "-"}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{result.actual_value}</td>
                      <td className="p-3 text-center text-slate-600">{result.unit || "-"}</td>
                      {test.results.some((r) => r.particle_size) && (
                        <td className="p-3 text-center text-slate-600">{result.particle_size || "-"}</td>
                      )}
                      <td className="p-3 text-center">
                        <div className="flex justify-center">
                          {result.status === "NORMAL" ? (
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          ) : result.status === "ALERT" ? (
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {test.image_url && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 text-center">TEST IMAGE - PARTICLE ANALYSIS</h4>
                <div className="flex flex-col items-center">
                  <img 
                    src={test.image_url} 
                    alt={`Test particles - ${test.test_name}`} 
                    className="max-w-md w-full h-auto rounded-lg border-2 border-slate-300 shadow-md object-contain"
                  />
                  {test.image_comment && (
                    <div className="mt-3 w-full max-w-md bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-medium text-slate-500 mb-1">Image Comment:</p>
                      <p className="text-slate-700">{test.image_comment}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="pdf-section bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <div className="w-1 h-6 bg-sky-500 rounded"></div>
              DATA INTERPRETATION & RECOMMENDATIONS
            </h3>
            {!editingRecommendations ? (
              <Button size="sm" variant="outline" onClick={() => setEditingRecommendations(true)} className="no-print">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <Button size="sm" onClick={saveRecommendations} className="bg-sky-600 hover:bg-sky-700 no-print">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            )}
          </div>
          
          <div className="border-l-4 border-sky-500 pl-4 bg-slate-50 p-4 rounded-r-lg">
            {editingRecommendations ? (
              <Textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Enter overall recommendations for this oil analysis case..."
                rows={6}
                className="resize-none bg-white"
              />
            ) : (
              <div className="text-slate-700 whitespace-pre-wrap">
                {caseData.recommendations || (
                  <p className="text-slate-400 italic">No recommendations added yet. Click Edit to add recommendations.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pdf-section bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-6 bg-sky-500 rounded"></div>
            DISCLAIMER
          </h3>
          <div className="text-xs text-slate-600 space-y-1 border-l-4 border-slate-300 pl-4">
            <p>1. Samples tested as received. The test results relate only to the items tested.</p>
            <p>2. Comments mentioned in the report can be used for consulting purpose only & shall not be used in case of any legal matters.</p>
            <p>3. Tested samples will be retained for one month from the date of testing unless specified by the customer.</p>
            <p>4. The test report shall not be reproduced except in full without the written permission.</p>
          </div>
        </div>

        <div className="pdf-section bg-white rounded-lg shadow-sm px-6 py-4">
          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              <p className="font-semibold text-slate-700">{companySettings?.company_name || "Oil Analysis Lab"}</p>
              <p>
                {companySettings?.address && `${companySettings.address} | `}
                {companySettings?.contact_number && `Phone: ${companySettings.contact_number} | `}
                {companySettings?.email && `Email: ${companySettings.email}`}
              </p>
            </div>
            {qrCodeDataUrl && (
              <div className="text-center">
                <img src={qrCodeDataUrl} alt="Scan for online report" className="w-24 h-24 mx-auto" />
                <p className="text-xs text-slate-500 mt-1">Scan for online report</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDashboard;
