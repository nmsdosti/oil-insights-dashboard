import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Download, Loader2, Edit, Save, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend
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

  // Convert external image to base64 to avoid CORS issues in PDF
  const convertImageToBase64 = async (imgElement: HTMLImageElement): Promise<string | null> => {
    try {
      const response = await fetch(imgElement.src, { mode: 'cors' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      // If fetch fails, try canvas approach
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0);
          return canvas.toDataURL('image/png');
        }
      } catch {
        return null;
      }
      return null;
    }
  };

  const generatePDF = async () => {
    if (!dashboardRef.current) return;

    setGenerating(true);
    toast.info("Generating PDF... Converting images...");

    try {
      // Pre-convert all external images to base64
      const images = dashboardRef.current.querySelectorAll('img');
      const originalSrcs = new Map<HTMLImageElement, string>();
      
      for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
          originalSrcs.set(img, img.src);
          const base64 = await convertImageToBase64(img);
          if (base64) {
            img.src = base64;
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

      // Restore original image sources
      for (const [img, src] of originalSrcs) {
        img.src = src;
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
            <Button asChild variant="outline">
              <Link to={`/case/${caseId}/add-test`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Test
              </Link>
            </Button>
            <Button onClick={generatePDF} disabled={generating} className="bg-sky-600 hover:bg-sky-700">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export PDF
            </Button>
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
            <div>
              <span className="font-semibold">CLIENT:</span> {caseData.customer_name}
            </div>
            {caseData.customer_email && (
              <div>
                <span className="font-semibold">EMAIL:</span> {caseData.customer_email}
              </div>
            )}
            <div>
              <span className="font-semibold">REPORT DATE:</span> {format(new Date(), "MMM d, yyyy")}
            </div>
            <div>
              <span className="font-semibold">SAMPLE DATE:</span> {format(new Date(caseData.created_at), "MMM d, yyyy")}
            </div>
          </div>
        </div>

        <div className="pdf-section bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-sky-500 rounded"></div>
            EXECUTIVE SUMMARY
          </h3>
          <div className={`flex items-start gap-4 p-4 rounded-lg ${conditionInfo.bgColor}`}>
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: conditionInfo.color }}
            >
              <ConditionIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className={`text-2xl font-bold ${conditionInfo.textColor}`}>
                {conditionInfo.label}
              </h4>
              <p className="text-sm text-slate-600 mt-1">CONDITION</p>
              <p className="text-slate-700 mt-2">{conditionInfo.message}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">Machine Condition</p>
              <Badge className={`text-base px-3 py-1 ${
                caseData.machine_condition === "NORMAL" ? "bg-green-500" :
                caseData.machine_condition === "ALERT" ? "bg-amber-500" : "bg-red-500"
              } text-white`}>
                {caseData.machine_condition}
              </Badge>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500 mb-1">Lubricant Condition</p>
              <Badge className={`text-base px-3 py-1 ${
                caseData.lubricant_condition === "NORMAL" ? "bg-green-500" :
                caseData.lubricant_condition === "ALERT" ? "bg-amber-500" : "bg-red-500"
              } text-white`}>
                {caseData.lubricant_condition}
              </Badge>
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
              <Button size="sm" variant="outline" onClick={() => setEditingRecommendations(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : (
              <Button size="sm" onClick={saveRecommendations} className="bg-sky-600 hover:bg-sky-700">
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

        <div className="pdf-section bg-white rounded-lg shadow-sm px-6 py-4">
          <div className="border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700 text-center">{companySettings?.company_name || "Oil Analysis Lab"}</p>
            <p className="text-center">
              {companySettings?.address && `${companySettings.address} | `}
              {companySettings?.contact_number && `Phone: ${companySettings.contact_number} | `}
              {companySettings?.email && `Email: ${companySettings.email}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDashboard;
