import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Download, Loader2, Edit, Save } from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar 
} from "recharts";
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
  recommendations: string;
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
  NORMAL: "hsl(var(--success))",
  ALERT: "hsl(var(--warning))",
  ALARM: "hsl(var(--destructive))",
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

    setCaseData(caseInfo);
    setRecommendations(caseInfo.recommendations || "");

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
          particle_size,
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
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      // Get all sections
      const sections = dashboardRef.current.querySelectorAll(".pdf-section");
      let yPosition = margin;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;
        
        const canvas = await html2canvas(section, {
          scale: 2,
          logging: false,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if we need a new page
        if (yPosition + imgHeight > pageHeight - margin && i > 0) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 5;

        // Add page break after large sections
        if (imgHeight > pageHeight / 2) {
          pdf.addPage();
          yPosition = margin;
        }
      }

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

  const pieData = [
    { name: "NORMAL", value: statusCounts.NORMAL, fill: COLORS.NORMAL },
    { name: "ALERT", value: statusCounts.ALERT, fill: COLORS.ALERT },
    { name: "ALARM", value: statusCounts.ALARM, fill: COLORS.ALARM },
  ].filter((d) => d.value > 0);

  const radialData = [
    {
      name: "Normal",
      value: statusCounts.NORMAL,
      fill: COLORS.NORMAL,
    },
    {
      name: "Alert",
      value: statusCounts.ALERT,
      fill: COLORS.ALERT,
    },
    {
      name: "Alarm",
      value: statusCounts.ALARM,
      fill: COLORS.ALARM,
    },
  ];

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
        <div className="pdf-section flex items-start justify-between border-b border-border pb-6">
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
        <Card className="pdf-section">
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
        <div className="pdf-section grid gap-4 md:grid-cols-2">
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

        {/* Charts Grid */}
        <div className="pdf-section grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Parameter status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
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

          <Card>
            <CardHeader>
              <CardTitle>Parameter Status</CardTitle>
              <CardDescription>Radial comparison view</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="90%"
                  barSize={20}
                  data={radialData}
                >
                  <RadialBar
                    background
                    dataKey="value"
                  />
                  <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bar Chart */}
        <Card className="pdf-section">
          <CardHeader>
            <CardTitle>Test Results Overview</CardTitle>
            <CardDescription>Distribution of parameter statuses across all tests</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: "NORMAL", count: statusCounts.NORMAL, fill: COLORS.NORMAL },
                  { name: "ALERT", count: statusCounts.ALERT, fill: COLORS.ALERT },
                  { name: "ALARM", count: statusCounts.ALARM, fill: COLORS.ALARM },
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
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {[statusCounts.NORMAL, statusCounts.ALERT, statusCounts.ALARM].map((_, index) => (
                    <Cell key={`cell-${index}`} fill={[COLORS.NORMAL, COLORS.ALERT, COLORS.ALARM][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recommendations Section */}
        <Card className="pdf-section">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Recommendations</CardTitle>
              {!editingRecommendations ? (
                <Button size="sm" variant="outline" onClick={() => setEditingRecommendations(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <Button size="sm" onClick={saveRecommendations}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingRecommendations ? (
              <div className="space-y-2">
                <Textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Enter overall recommendations for this oil analysis case..."
                  rows={6}
                  className="resize-none"
                />
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">
                {caseData.recommendations || (
                  <p className="text-muted-foreground italic">No recommendations added yet. Click Edit to add recommendations.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Tests */}
        {tests.map((test) => (
          <Card key={test.id} className="pdf-section">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle>{test.test_name}</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/case/${caseId}/test/${test.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
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
                      {test.results.some((r) => r.particle_size) && (
                        <th className="text-left p-2 font-semibold">Particle Size</th>
                      )}
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
                        {test.results.some((r) => r.particle_size) && (
                          <td className="p-2">{result.particle_size || "-"}</td>
                        )}
                        <td className="p-2">
                          <Badge className={getConditionColor(result.status)}>{result.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Area Chart for Test */}
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={test.results}>
                  <defs>
                    <linearGradient id={`colorActual-${test.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="parameter_name" 
                    stroke="hsl(var(--muted-foreground))" 
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual_value"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill={`url(#colorActual-${test.id})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CaseDashboard;
