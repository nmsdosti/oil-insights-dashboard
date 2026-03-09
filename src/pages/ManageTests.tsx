import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Edit, FlaskConical, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import TestMethodSelect from "@/components/TestMethodSelect";

interface Parameter {
  id: string;
  dbId?: string;
  name: string;
  lowerLimit: string;
  upperLimit: string;
  actualValue: string;
  unit: string;
  particleSize: string;
  testMethod: string;
}

interface TestEntry {
  id: string;
  test_name: string;
  image_url: string | null;
  image_comment: string | null;
  parameters: Parameter[];
  isNew?: boolean;
  isDirty?: boolean;
}

interface TestTemplate {
  id: string;
  test_name: string;
}

const ManageTests = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tests, setTests] = useState<TestEntry[]>([]);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [customerName, setCustomerName] = useState("");

  // New test form state
  const [showNewTest, setShowNewTest] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [newSelectedTemplate, setNewSelectedTemplate] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");
  const [newImageComment, setNewImageComment] = useState("");
  const [newParameters, setNewParameters] = useState<Parameter[]>([
    { id: "new-1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" },
  ]);
  const [addingTest, setAddingTest] = useState(false);

  useEffect(() => {
    fetchData();
  }, [caseId]);

  const fetchData = async () => {
    const [caseRes, testsRes, templatesRes] = await Promise.all([
      supabase.from("cases").select("customer_name").eq("id", caseId).single(),
      supabase.from("case_tests").select(`
        id, test_name, image_url, image_comment,
        case_test_results (id, parameter_name, lower_limit, upper_limit, actual_value, unit, particle_size, status, test_method)
      `).eq("case_id", caseId),
      supabase.from("test_templates").select("*"),
    ]);

    if (caseRes.data) setCustomerName(caseRes.data.customer_name);
    if (templatesRes.data) setTemplates(templatesRes.data);

    if (testsRes.data) {
      setTests(testsRes.data.map((t: any) => ({
        id: t.id,
        test_name: t.test_name,
        image_url: t.image_url,
        image_comment: t.image_comment,
        parameters: (t.case_test_results || []).map((r: any) => ({
          id: r.id,
          dbId: r.id,
          name: r.parameter_name,
          lowerLimit: r.lower_limit?.toString() || "",
          upperLimit: r.upper_limit?.toString() || "",
          actualValue: r.actual_value?.toString() || "",
          unit: r.unit || "",
          particleSize: r.particle_size || "",
          testMethod: r.test_method || "",
        })),
      })));
    }
    setLoading(false);
  };

  const calculateStatus = (actual: number, lower?: number, upper?: number): string => {
    if (lower !== undefined && actual < lower) return "ALARM";
    if (upper !== undefined && actual > upper) return "ALARM";
    if (lower !== undefined && actual < lower * 1.1) return "ALERT";
    if (upper !== undefined && actual > upper * 0.9) return "ALERT";
    return "NORMAL";
  };

  const getStatusIcon = (actual: string, lower: string, upper: string) => {
    if (!actual) return null;
    const status = calculateStatus(
      parseFloat(actual),
      lower ? parseFloat(lower) : undefined,
      upper ? parseFloat(upper) : undefined
    );
    if (status === "NORMAL") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "ALERT") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  // --- Existing test editing ---
  const updateTestParam = (testId: string, paramId: string, field: keyof Parameter, value: string) => {
    setTests(tests.map(t => t.id === testId ? {
      ...t,
      isDirty: true,
      parameters: t.parameters.map(p => p.id === paramId ? { ...p, [field]: value } : p),
    } : t));
  };

  const addParamToTest = (testId: string) => {
    setTests(tests.map(t => t.id === testId ? {
      ...t,
      isDirty: true,
      parameters: [...t.parameters, { id: `new-${Date.now()}`, name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" }],
    } : t));
  };

  const removeParamFromTest = (testId: string, paramId: string) => {
    setTests(tests.map(t => t.id === testId ? {
      ...t,
      isDirty: true,
      parameters: t.parameters.filter(p => p.id !== paramId),
    } : t));
  };

  const updateTestName = (testId: string, name: string) => {
    setTests(tests.map(t => t.id === testId ? { ...t, test_name: name, isDirty: true } : t));
  };

  const saveTest = async (test: TestEntry) => {
    if (!test.test_name.trim()) { toast.error("Test name is required"); return; }
    if (test.parameters.some(p => !p.name.trim() || !p.actualValue.trim())) {
      toast.error("Fill in all parameter names and actual values");
      return;
    }

    setSaving(test.id);

    // Update test name
    const { error: testErr } = await supabase.from("case_tests").update({ test_name: test.test_name }).eq("id", test.id);
    if (testErr) { toast.error("Failed to update test"); setSaving(null); return; }

    // Delete all existing results and re-insert
    await supabase.from("case_test_results").delete().eq("case_test_id", test.id);

    const results = test.parameters.map(p => {
      const actual = parseFloat(p.actualValue);
      const lower = p.lowerLimit ? parseFloat(p.lowerLimit) : undefined;
      const upper = p.upperLimit ? parseFloat(p.upperLimit) : undefined;
      return {
        case_test_id: test.id,
        parameter_name: p.name,
        lower_limit: lower,
        upper_limit: upper,
        actual_value: actual,
        unit: p.unit || null,
        particle_size: p.particleSize || null,
        test_method: p.testMethod || null,
        status: calculateStatus(actual, lower, upper),
      };
    });

    const { error: resErr } = await supabase.from("case_test_results").insert(results);
    if (resErr) toast.error("Failed to save results");
    else {
      toast.success(`"${test.test_name}" saved!`);
      setTests(tests.map(t => t.id === test.id ? { ...t, isDirty: false } : t));
    }
    setSaving(null);
  };

  const deleteTest = async (testId: string, testName: string) => {
    if (!confirm(`Delete test "${testName}" and all its parameters?`)) return;
    
    await supabase.from("case_test_results").delete().eq("case_test_id", testId);
    const { error } = await supabase.from("case_tests").delete().eq("id", testId);
    if (error) toast.error("Failed to delete test");
    else {
      toast.success("Test deleted");
      setTests(tests.filter(t => t.id !== testId));
    }
  };

  // --- New test ---
  const loadTemplate = async (templateId: string) => {
    const { data: template } = await supabase.from("test_templates").select("test_name").eq("id", templateId).single();
    const { data: params } = await supabase.from("test_parameters").select("*").eq("template_id", templateId);
    if (template && params) {
      setNewTestName(template.test_name);
      setNewParameters(params.map((p, idx) => ({
        id: `new-${idx}`, name: p.parameter_name, lowerLimit: p.lower_limit?.toString() || "",
        upperLimit: p.upper_limit?.toString() || "", actualValue: "", unit: p.unit || "", particleSize: "", testMethod: "",
      })));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('test-images').upload(fileName, file);
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('test-images').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleAddNewTest = async () => {
    if (!newTestName.trim()) { toast.error("Enter a test name"); return; }
    if (newParameters.some(p => !p.name.trim() || !p.actualValue.trim())) {
      toast.error("Fill in all parameter names and actual values");
      return;
    }

    setAddingTest(true);
    let imageUrl: string | null = null;
    if (newImageFile) imageUrl = await uploadImage(newImageFile);

    const { data: testData, error: testErr } = await supabase.from("case_tests")
      .insert({ case_id: caseId, test_name: newTestName, image_url: imageUrl, image_comment: newImageComment || null })
      .select().single();

    if (testErr) { toast.error("Failed to create test"); setAddingTest(false); return; }

    const results = newParameters.map(p => {
      const actual = parseFloat(p.actualValue);
      const lower = p.lowerLimit ? parseFloat(p.lowerLimit) : undefined;
      const upper = p.upperLimit ? parseFloat(p.upperLimit) : undefined;
      return {
        case_test_id: testData.id, parameter_name: p.name, lower_limit: lower, upper_limit: upper,
        actual_value: actual, unit: p.unit || null, particle_size: p.particleSize || null,
        test_method: p.testMethod || null, status: calculateStatus(actual, lower, upper),
      };
    });

    const { error: resErr } = await supabase.from("case_test_results").insert(results);
    if (resErr) {
      toast.error("Failed to save test results");
    } else {
      toast.success("Test added!");
      // Save as template option
      if (confirm("Save this test as a template for future use?")) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tmpl } = await supabase.from("test_templates").insert({ user_id: user.id, test_name: newTestName }).select().single();
          if (tmpl) {
            await supabase.from("test_parameters").insert(newParameters.map(p => ({
              template_id: tmpl.id, parameter_name: p.name,
              lower_limit: p.lowerLimit ? parseFloat(p.lowerLimit) : null,
              upper_limit: p.upperLimit ? parseFloat(p.upperLimit) : null,
              unit: p.unit || null,
            })));
            toast.success("Template saved!");
          }
        }
      }

      // Reset and refresh
      setShowNewTest(false);
      setNewTestName("");
      setNewSelectedTemplate("");
      setNewImageFile(null);
      setNewImagePreview("");
      setNewImageComment("");
      setNewParameters([{ id: "new-1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" }]);
      fetchData();
    }
    setAddingTest(false);
  };

  const addNewParameter = () => {
    setNewParameters([...newParameters, { id: `new-${Date.now()}`, name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" }]);
  };

  const updateNewParameter = (id: string, field: keyof Parameter, value: string) => {
    setNewParameters(newParameters.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeNewParameter = (id: string) => {
    setNewParameters(newParameters.filter(p => p.id !== id));
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(`/case/${caseId}`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Tests</h1>
          <p className="text-muted-foreground mt-1">
            {customerName} — Edit existing tests or add new ones
          </p>
        </div>
        <Button onClick={() => setShowNewTest(!showNewTest)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Test
        </Button>
      </div>

      {/* Add New Test Section */}
      {showNewTest && (
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Add New Test
            </CardTitle>
            <CardDescription>Create a new test with parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Use Template (Optional)</Label>
                <Select value={newSelectedTemplate} onValueChange={(v) => { setNewSelectedTemplate(v); loadTemplate(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.test_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Test Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g., Viscosity Analysis" value={newTestName} onChange={e => setNewTestName(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Test Image (Optional)</Label>
                <Input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setNewImageFile(f); setNewImagePreview(URL.createObjectURL(f)); }
                }} />
                {newImagePreview && <img src={newImagePreview} alt="Preview" className="max-w-xs rounded-lg border mt-2" />}
              </div>
              {newImagePreview && (
                <div className="space-y-2">
                  <Label>Image Comment</Label>
                  <Input placeholder="Comment..." value={newImageComment} onChange={e => setNewImageComment(e.target.value)} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Parameters</h4>
              <Button size="sm" variant="outline" onClick={addNewParameter}><Plus className="mr-1 h-3 w-3" />Add Parameter</Button>
            </div>

            {newParameters.map((param, idx) => (
              <div key={param.id} className="rounded-lg border border-border p-3 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Parameter {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(param.actualValue, param.lowerLimit, param.upperLimit)}
                    {newParameters.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewParameter(param.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-6">
                  <div className="md:col-span-2"><Input placeholder="Parameter Name *" value={param.name} onChange={e => updateNewParameter(param.id, "name", e.target.value)} className="text-sm" /></div>
                  <Input type="number" step="any" placeholder="Lower" value={param.lowerLimit} onChange={e => updateNewParameter(param.id, "lowerLimit", e.target.value)} className="text-sm" />
                  <Input type="number" step="any" placeholder="Upper" value={param.upperLimit} onChange={e => updateNewParameter(param.id, "upperLimit", e.target.value)} className="text-sm" />
                  <Input placeholder="Unit" value={param.unit} onChange={e => updateNewParameter(param.id, "unit", e.target.value)} className="text-sm" />
                  <Input placeholder="Particle Size" value={param.particleSize} onChange={e => updateNewParameter(param.id, "particleSize", e.target.value)} className="text-sm" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input type="number" step="any" placeholder="Actual Value *" value={param.actualValue} onChange={e => updateNewParameter(param.id, "actualValue", e.target.value)} className="text-sm" />
                  <TestMethodSelect value={param.testMethod} onChange={v => updateNewParameter(param.id, "testMethod", v)} />
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleAddNewTest} disabled={addingTest} className="flex-1">
                {addingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {addingTest ? "Adding..." : "Add Test"}
              </Button>
              <Button variant="outline" onClick={() => setShowNewTest(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Tests */}
      {tests.length === 0 && !showNewTest ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No tests yet</h3>
            <p className="text-muted-foreground mb-6">Add your first test to start recording results</p>
            <Button onClick={() => setShowNewTest(true)}><Plus className="mr-2 h-4 w-4" />Add Test</Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={tests.map(t => t.id)} className="space-y-4">
          {tests.map((test) => (
            <AccordionItem key={test.id} value={test.id} className="border rounded-lg bg-card shadow-sm">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">{test.test_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{test.parameters.length} parameters</span>
                  {test.isDirty && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Unsaved</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Test Name</Label>
                      <Input value={test.test_name} onChange={e => updateTestName(test.id, e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-5">
                      <Button size="sm" variant="outline" onClick={() => addParamToTest(test.id)}>
                        <Plus className="mr-1 h-3 w-3" />Add Parameter
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteTest(test.id, test.test_name)}>
                        <Trash2 className="mr-1 h-3 w-3" />Delete Test
                      </Button>
                    </div>
                  </div>

                  {test.parameters.map((param, idx) => (
                    <div key={param.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Parameter {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(param.actualValue, param.lowerLimit, param.upperLimit)}
                          {test.parameters.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeParamFromTest(test.id, param.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-6">
                        <div className="md:col-span-2">
                          <Input placeholder="Parameter Name *" value={param.name} onChange={e => updateTestParam(test.id, param.id, "name", e.target.value)} className="text-sm" />
                        </div>
                        <Input type="number" step="any" placeholder="Lower" value={param.lowerLimit} onChange={e => updateTestParam(test.id, param.id, "lowerLimit", e.target.value)} className="text-sm" />
                        <Input type="number" step="any" placeholder="Upper" value={param.upperLimit} onChange={e => updateTestParam(test.id, param.id, "upperLimit", e.target.value)} className="text-sm" />
                        <Input placeholder="Unit" value={param.unit} onChange={e => updateTestParam(test.id, param.id, "unit", e.target.value)} className="text-sm" />
                        <Input placeholder="Particle Size" value={param.particleSize} onChange={e => updateTestParam(test.id, param.id, "particleSize", e.target.value)} className="text-sm" />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input type="number" step="any" placeholder="Actual Value *" value={param.actualValue} onChange={e => updateTestParam(test.id, param.id, "actualValue", e.target.value)} className="text-sm" />
                        <TestMethodSelect value={param.testMethod} onChange={v => updateTestParam(test.id, param.id, "testMethod", v)} />
                      </div>
                    </div>
                  ))}

                  <Button onClick={() => saveTest(test)} disabled={saving === test.id} className="w-full">
                    {saving === test.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving === test.id ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default ManageTests;
