import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Loader2, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, FileText, ChevronDown, FileImage } from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { toast } from "sonner";

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

const PublicReport = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [tests, setTests] = useState<TestData[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) {
      setError("Invalid access link");
      setLoading(false);
      return;
    }

    // Fetch case by access token
    const { data: caseInfo, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("access_token", token)
      .single();

    if (caseError || !caseInfo) {
      setError("Report not found or access link is invalid");
      setLoading(false);
      return;
    }

    setCaseData(caseInfo as CaseData);

    // Fetch tests for this case
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
          status
        )
      `)
      .eq("case_id", caseInfo.id);

    if (!testsError && testsData) {
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

    // Fetch company settings for the case owner
    const { data: settings } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", caseInfo.user_id)
      .single();

    if (settings) {
      setCompanySettings(settings);
    }

    setLoading(false);
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
        message: "Critical condition detected. Immediate action required.",
      };
    }
    if (conditions.includes("ALERT")) {
      return {
        label: "ALERT",
        color: COLORS.ALERT,
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        icon: AlertTriangle,
        message: "Some parameters are outside normal limits. Monitor closely.",
      };
    }
    return {
      label: "NORMAL",
      color: COLORS.NORMAL,
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      icon: CheckCircle,
      message: "All parameters are within acceptable limits.",
    };
  };

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
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  };

  const generatePDF = async () => {
    if (!caseData) return;
    setGenerating(true);
    toast.info("Generating PDF...");

    try {
      const dashboardEl = document.getElementById('public-report-content');
      if (!dashboardEl) {
        toast.error("Could not find report content");
        setGenerating(false);
        return;
      }

      const images = dashboardEl.querySelectorAll('img');
      const originalSrcs = new Map<HTMLImageElement, string>();
      
      for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
          originalSrcs.set(img, img.src);
          const base64 = await convertImageToBase64(img.src);
          if (base64) {
            img.src = base64;
          } else {
            img.style.display = 'none';
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      const sections = dashboardEl.querySelectorAll(".pdf-section");
      let yPosition = margin;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        
        const canvas = await html2canvas(section, {
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
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

      for (const [img, src] of originalSrcs) {
        img.src = src;
        img.style.display = '';
      }

      pdf.save(`oil-analysis-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
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

      sheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 20 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
      ];

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

      let row = 4;
      const addInfoRow = (label: string, value: string) => {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.mergeCells(`B${row}:D${row}`);
        sheet.getCell(`B${row}`).value = value;
        row++;
      };

      addInfoRow("CLIENT:", caseData.customer_name);
      addInfoRow("REPORT DATE:", format(new Date(), "MMM d, yyyy"));
      addInfoRow("SAMPLE DATE:", format(new Date(caseData.created_at), "MMM d, yyyy"));

      row += 1;

      const condInfo = getConditionInfo(caseData.machine_condition, caseData.lubricant_condition);
      
      sheet.mergeCells(`A${row}:G${row}`);
      const summaryHeader = sheet.getCell(`A${row}`);
      summaryHeader.value = "EXECUTIVE SUMMARY";
      summaryHeader.font = { bold: true, size: 12 };
      summaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      row++;

      addInfoRow("Overall Status:", condInfo.label);
      addInfoRow("Machine Condition:", caseData.machine_condition);
      addInfoRow("Lubricant Condition:", caseData.lubricant_condition);
      row++;

      for (const test of tests) {
        sheet.mergeCells(`A${row}:G${row}`);
        const testHeader = sheet.getCell(`A${row}`);
        testHeader.value = `TEST RESULTS - ${test.test_name.toUpperCase()}`;
        testHeader.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        testHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
        row++;

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
            
            if (i === 6) {
              if (val === "NORMAL") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } };
              else if (val === "ALERT") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
              else if (val === "ALARM") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEF4444" } };
              cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            }
          });
          row++;
        }
        row++;
      }

      if (caseData.recommendations) {
        sheet.mergeCells(`A${row}:G${row}`);
        const recHeader = sheet.getCell(`A${row}`);
        recHeader.value = "RECOMMENDATIONS";
        recHeader.font = { bold: true, size: 12 };
        recHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        row++;

        sheet.mergeCells(`A${row}:G${row + 3}`);
        const recCell = sheet.getCell(`A${row}`);
        recCell.value = caseData.recommendations;
        recCell.alignment = { wrapText: true, vertical: "top" };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `oil-analysis-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
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
      const children: any[] = [];

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

      const infoItems = [
        { label: "CLIENT:", value: caseData.customer_name },
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
          spacing: { after: 200 },
        })
      );

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
      }

      if (caseData.recommendations) {
        children.push(
          new Paragraph({
            text: "RECOMMENDATIONS",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: caseData.recommendations,
            spacing: { after: 400 },
          })
        );
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `oil-analysis-report-${format(new Date(), "yyyy-MM-dd")}.docx`);
      toast.success("Word document generated successfully!");
    } catch (error) {
      console.error("Error generating Word:", error);
      toast.error("Failed to generate Word document");
    }

    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">{error || "Report not found"}</p>
          </CardContent>
        </Card>
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {companySettings?.logo_url && (
              <img src={companySettings.logo_url} alt="Company Logo" className="h-10 w-auto" />
            )}
            <span className="font-semibold text-lg">{companySettings?.company_name || "Oil Analysis Report"}</span>
          </div>
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
                <FileImage className="mr-2 h-4 w-4" />
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

      {/* Report Content */}
      <div id="public-report-content" className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Section */}
        <div className="pdf-section bg-gradient-to-r from-sky-600 to-cyan-500 text-white rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{companySettings?.company_name || "Oil Analysis Lab"}</h1>
              <p className="text-sky-100">Comprehensive Oil Analysis Report</p>
            </div>
            {companySettings?.logo_url && (
              <img src={companySettings.logo_url} alt="Logo" className="h-16 w-auto bg-white rounded-lg p-2" />
            )}
          </div>
        </div>

        {/* Client Info */}
        <Card className="pdf-section">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Client Name</p>
                <p className="font-semibold text-lg">{caseData.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Report Date</p>
                <p className="font-semibold">{format(new Date(), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sample Date</p>
                <p className="font-semibold">{format(new Date(caseData.created_at), "MMM d, yyyy")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card className={`pdf-section ${conditionInfo.bgColor}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ConditionIcon className="h-6 w-6" style={{ color: conditionInfo.color }} />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${conditionInfo.bgColor}`}>
                <p className="text-sm text-muted-foreground">Overall Status</p>
                <Badge 
                  className="mt-1 text-white"
                  style={{ backgroundColor: conditionInfo.color }}
                >
                  {conditionInfo.label}
                </Badge>
              </div>
              <div className="p-4 rounded-lg bg-white">
                <p className="text-sm text-muted-foreground">Machine Condition</p>
                <p className="font-semibold">{caseData.machine_condition}</p>
              </div>
              <div className="p-4 rounded-lg bg-white">
                <p className="text-sm text-muted-foreground">Lubricant Condition</p>
                <p className="font-semibold">{caseData.lubricant_condition}</p>
              </div>
            </div>
            <p className={`${conditionInfo.textColor}`}>{conditionInfo.message}</p>
          </CardContent>
        </Card>

        {/* Status Charts */}
        {pieData.length > 0 && (
          <div className="pdf-section grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Parameter Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {barChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Parameter Values</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
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
            )}
          </div>
        )}

        {/* Test Results */}
        {tests.map((test) => (
          <Card key={test.id} className="pdf-section">
            <CardHeader className="bg-sky-600 text-white rounded-t-lg">
              <CardTitle>{test.test_name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {test.image_url && (
                <div className="mb-4">
                  <img
                    src={test.image_url}
                    alt={test.test_name}
                    className="max-h-64 object-contain rounded-lg mx-auto"
                  />
                  {test.image_comment && (
                    <p className="text-sm text-muted-foreground mt-2 text-center italic">{test.image_comment}</p>
                  )}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-sky-600 text-white">
                      <th className="p-3 text-left">Parameter</th>
                      <th className="p-3 text-center">Lower Limit</th>
                      <th className="p-3 text-center">Upper Limit</th>
                      <th className="p-3 text-center">Actual Value</th>
                      <th className="p-3 text-center">Unit</th>
                      {test.results.some(r => r.particle_size) && (
                        <th className="p-3 text-center">Particle Size</th>
                      )}
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {test.results.map((result, idx) => (
                      <tr key={result.id} className={idx % 2 === 0 ? "bg-slate-50" : ""}>
                        <td className="p-3 font-medium">{result.parameter_name}</td>
                        <td className="p-3 text-center">{result.lower_limit ?? "-"}</td>
                        <td className="p-3 text-center">{result.upper_limit ?? "-"}</td>
                        <td className="p-3 text-center font-semibold">{result.actual_value}</td>
                        <td className="p-3 text-center">{result.unit || "-"}</td>
                        {test.results.some(r => r.particle_size) && (
                          <td className="p-3 text-center">{result.particle_size || "-"}</td>
                        )}
                        <td className="p-3 text-center">
                          <Badge
                            className="text-white"
                            style={{ 
                              backgroundColor: result.status === "NORMAL" ? COLORS.NORMAL : 
                                result.status === "ALERT" ? COLORS.ALERT : COLORS.ALARM 
                            }}
                          >
                            {result.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Recommendations */}
        {caseData.recommendations && (
          <Card className="pdf-section">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{caseData.recommendations}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="pdf-section text-center text-sm text-muted-foreground py-4">
          <p>{companySettings?.company_name || "Oil Analysis Lab"}</p>
          {companySettings?.address && <p>{companySettings.address}</p>}
          {(companySettings?.contact_number || companySettings?.email) && (
            <p>{[companySettings.contact_number, companySettings.email].filter(Boolean).join(" | ")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicReport;
