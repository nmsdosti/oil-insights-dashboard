import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Trash2, Edit } from "lucide-react";
import { Link } from "react-router-dom";

type Condition = "NORMAL" | "ALERT" | "ALARM";

interface TestInfo {
  id: string;
  test_name: string;
  created_at: string;
}

const EditCase = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [lubricantGrade, setLubricantGrade] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [samplingPoint, setSamplingPoint] = useState("");
  const [ulrNumber, setUlrNumber] = useState("");
  const [sampleReceiptDate, setSampleReceiptDate] = useState("");
  const [sampleTestingDate, setSampleTestingDate] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [machineCondition, setMachineCondition] = useState<Condition>("NORMAL");
  const [lubricantCondition, setLubricantCondition] = useState<Condition>("NORMAL");
  const [recommendations, setRecommendations] = useState("");
  const [tests, setTests] = useState<TestInfo[]>([]);

  useEffect(() => {
    fetchCaseData();
  }, [caseId]);

  const fetchCaseData = async () => {
    const { data: caseInfo, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (error) {
      toast.error("Failed to load case data");
      console.error(error);
      return;
    }

    setCustomerName(caseInfo.customer_name);
    setCustomerAddress(caseInfo.customer_address || "");
    setCustomerMobile(caseInfo.customer_mobile || "");
    setCustomerEmail(caseInfo.customer_email || "");
    setSampleId((caseInfo as any).sample_id || "");
    setLubricantGrade((caseInfo as any).lubricant_grade || "");
    setEquipmentId((caseInfo as any).equipment_id || "");
    setSamplingPoint((caseInfo as any).sampling_point || "");
    setUlrNumber((caseInfo as any).ulr_number || "");
    setSampleReceiptDate((caseInfo as any).sample_receipt_date || "");
    setSampleTestingDate((caseInfo as any).sample_testing_date || "");
    setReportDate((caseInfo as any).report_date || "");
    setMachineCondition(caseInfo.machine_condition as Condition);
    setLubricantCondition(caseInfo.lubricant_condition as Condition);
    setRecommendations(caseInfo.recommendations || "");

    // Fetch tests
    const { data: testsData } = await supabase
      .from("case_tests")
      .select("id, test_name, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (testsData) setTests(testsData);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from("cases")
      .update({
        customer_name: customerName,
        customer_address: customerAddress || null,
        customer_mobile: customerMobile || null,
        customer_email: customerEmail || null,
        sample_id: sampleId || null,
        lubricant_grade: lubricantGrade || null,
        equipment_id: equipmentId || null,
        sampling_point: samplingPoint || null,
        ulr_number: ulrNumber || null,
        sample_receipt_date: sampleReceiptDate || null,
        sample_testing_date: sampleTestingDate || null,
        report_date: reportDate || null,
        machine_condition: machineCondition,
        lubricant_condition: lubricantCondition,
        recommendations: recommendations || null,
      } as any)
      .eq("id", caseId);

    if (error) {
      toast.error("Failed to save case");
      console.error(error);
    } else {
      toast.success("Case updated successfully!");
      navigate(`/case/${caseId}/dashboard`);
    }
    setSaving(false);
  };

  const deleteTest = async (testId: string) => {
    if (!window.confirm("Are you sure you want to delete this test?")) return;
    
    await supabase.from("case_test_results").delete().eq("case_test_id", testId);
    const { error } = await supabase.from("case_tests").delete().eq("id", testId);
    
    if (error) {
      toast.error("Failed to delete test");
    } else {
      toast.success("Test deleted");
      setTests(tests.filter(t => t.id !== testId));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(`/case/${caseId}/dashboard`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Case</h1>
        <p className="text-muted-foreground mt-1">Modify case details, sample information, and tests</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name <span className="text-destructive">*</span></Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sample ID</Label>
                <Input value={sampleId} onChange={(e) => setSampleId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lubricant Grade</Label>
                <Input value={lubricantGrade} onChange={(e) => setLubricantGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Equipment ID</Label>
                <Input value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sampling Point</Label>
                <Input value={samplingPoint} onChange={(e) => setSamplingPoint(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ULR Number</Label>
                <Input value={ulrNumber} onChange={(e) => setUlrNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Sample Receipt Date</Label>
                <Input type="date" value={sampleReceiptDate} onChange={(e) => setSampleReceiptDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sample Testing Date</Label>
                <Input type="date" value={sampleTestingDate} onChange={(e) => setSampleTestingDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Machine Condition</Label>
              <RadioGroup value={machineCondition} onValueChange={(v) => setMachineCondition(v as Condition)}>
                {(["NORMAL", "ALERT", "ALARM"] as Condition[]).map((c) => (
                  <div key={c} className="flex items-center space-x-2 rounded-lg border border-border p-3">
                    <RadioGroupItem value={c} id={`m-${c}`} />
                    <Label htmlFor={`m-${c}`} className={`cursor-pointer font-medium ${c === "NORMAL" ? "text-success" : c === "ALERT" ? "text-warning" : "text-destructive"}`}>{c}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <Label>Lubricant Condition</Label>
              <RadioGroup value={lubricantCondition} onValueChange={(v) => setLubricantCondition(v as Condition)}>
                {(["NORMAL", "ALERT", "ALARM"] as Condition[]).map((c) => (
                  <div key={c} className="flex items-center space-x-2 rounded-lg border border-border p-3">
                    <RadioGroupItem value={c} id={`l-${c}`} />
                    <Label htmlFor={`l-${c}`} className={`cursor-pointer font-medium ${c === "NORMAL" ? "text-success" : c === "ALERT" ? "text-warning" : "text-destructive"}`}>{c}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Enter recommendations..."
              rows={5}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tests ({tests.length})</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link to={`/case/${caseId}/add-test`}>Add Test</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tests added yet.</p>
            ) : (
              <div className="space-y-2">
                {tests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between border rounded-lg p-3">
                    <span className="font-medium">{test.test_name}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/case/${caseId}/test/${test.id}/edit`}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteTest(test.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default EditCase;
