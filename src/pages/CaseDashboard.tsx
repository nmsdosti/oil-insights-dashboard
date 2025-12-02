import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface CaseData {
  id: string;
  customer_name: string;
  customer_address: string;
  customer_mobile: string;
  customer_email: string;
  machine_condition: string;
  lubricant_condition: string;
  created_at: string;
}

interface TestData {
  id: string;
  test_name: string;
  image_url: string;
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
  status: string;
}

interface CompanySettings {
  company_name: string;
  logo_url: string;
  contact_number: string;
  email: string;
  address: string;
}

const CaseDashboard = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [tests, setTests] = useState<TestData[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [caseId]);

  const fetchData = async () => {
    // Fetch case data
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

    setCaseData(caseInfo);

    // Fetch tests and results
    const { data: testsData, error: testsError } = await supabase
      .from("case_tests")
      .select(`
        id,
        test_name,
        image_url,
        created_at,
        case_test_results (
          id,
          parameter_name,
          lower_limit,
          upper_limit,
          actual_value,
          unit,
          status
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
        created_at: test.created_at,
        results: test.case_test_results || [],
      }));
      setTests(formattedTests);
    }

    // Fetch company settings
    const { data: settings } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (settings) {
      setCompanySettings(settings);
    }

    setLoading(false);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "NORMAL":
        return "bg-success text-success-foreground";
      case "ALERT":
        return "bg-warning text-warning-foreground";
      case "ALARM":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const generatePDF = async () => {
    if (!dashboardRef.current) return;

    setGenerating(true);
    toast.info("Generating PDF...");

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`oil-analysis-${caseData?.customer_name}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cases
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/case/${caseId}/add-test`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Test
            </Link>
          </Button>
          <Button onClick={generatePDF} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-6 bg-background p-6 rounded-lg">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            {companySettings?.logo_url && (
              <img src={companySettings.logo_url} alt="Company Logo" className="h-16 mb-4" />
            )}
            <h1 className="text-3xl font-bold">{companySettings?.company_name || "Oil Analysis Lab"}</h1>
            {companySettings && (
              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                {companySettings.address && <p>{companySettings.address}</p>}
                {companySettings.contact_number && <p>Phone: {companySettings.contact_number}</p>}
                {companySettings.email && <p>Email: {companySettings.email}</p>}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Report Date</p>
            <p className="text-lg font-semibold">{format(new Date(), "MMMM d, yyyy")}</p>
          </div>
        </div>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-semibold">{caseData.customer_name}</p>
            </div>
            {caseData.customer_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold">{caseData.customer_email}</p>
              </div>
            )}
            {caseData.customer_mobile && (
              <div>
                <p className="text-sm text-muted-foreground">Mobile</p>
                <p className="font-semibold">{caseData.customer_mobile}</p>
              </div>
            )}
            {caseData.customer_address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-semibold">{caseData.customer_address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overall Status */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Machine Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`text-lg px-4 py-2 ${getConditionColor(caseData.machine_condition)}`}>
                {caseData.machine_condition}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lubricant Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`text-lg px-4 py-2 ${getConditionColor(caseData.lubricant_condition)}`}>
                {caseData.lubricant_condition}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results Overview</CardTitle>
            <CardDescription>Distribution of parameter statuses across all tests</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: "NORMAL", count: statusCounts.NORMAL, fill: "hsl(var(--success))" },
                  { name: "ALERT", count: statusCounts.ALERT, fill: "hsl(var(--warning))" },
                  { name: "ALARM", count: statusCounts.ALARM, fill: "hsl(var(--destructive))" },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Individual Tests */}
        {tests.map((test) => (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{test.test_name}</CardTitle>
                  <CardDescription>Performed on {format(new Date(test.created_at), "MMMM d, yyyy")}</CardDescription>
                </div>
                {test.image_url && (
                  <img src={test.image_url} alt="Test" className="h-24 w-24 rounded object-cover border border-border" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Parameter</th>
                      <th className="text-left p-2 font-semibold">Lower Limit</th>
                      <th className="text-left p-2 font-semibold">Upper Limit</th>
                      <th className="text-left p-2 font-semibold">Actual Value</th>
                      <th className="text-left p-2 font-semibold">Unit</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {test.results.map((result) => (
                      <tr key={result.id} className="border-b border-border/50">
                        <td className="p-2">{result.parameter_name}</td>
                        <td className="p-2">{result.lower_limit || "-"}</td>
                        <td className="p-2">{result.upper_limit || "-"}</td>
                        <td className="p-2 font-semibold">{result.actual_value}</td>
                        <td className="p-2">{result.unit || "-"}</td>
                        <td className="p-2">
                          <Badge className={getConditionColor(result.status)}>{result.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Parameter Chart */}
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={test.results}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="parameter_name" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="actual_value" stroke="hsl(var(--primary))" strokeWidth={2} name="Actual Value" />
                  <Line type="monotone" dataKey="lower_limit" stroke="hsl(var(--success))" strokeDasharray="5 5" name="Lower Limit" />
                  <Line type="monotone" dataKey="upper_limit" stroke="hsl(var(--destructive))" strokeDasharray="5 5" name="Upper Limit" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CaseDashboard;
