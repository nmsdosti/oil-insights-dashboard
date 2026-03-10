import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import TestMethodSelect from "@/components/TestMethodSelect";

interface Parameter {
  id: string;
  name: string;
  lowerLimit: string;
  upperLimit: string;
  actualValue: string;
  unit: string;
  particleSize: string;
  testMethod: string;
}

interface TestTemplate {
  id: string;
  test_name: string;
}

const AddTest = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testName, setTestName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageComment, setImageComment] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [parameters, setParameters] = useState<Parameter[]>([
    { id: "1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" },
  ]);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from("test_templates").select("*");
    if (!error) setTemplates(data || []);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageUrl("");
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); return null; }

    setUploadingImage(true);
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('test-images').upload(fileName, imageFile);
    if (uploadError) { toast.error("Failed to upload image"); setUploadingImage(false); return null; }

    const { data: { publicUrl } } = supabase.storage.from('test-images').getPublicUrl(fileName);
    setUploadingImage(false);
    return publicUrl;
  };

  const loadTemplate = async (templateId: string) => {
    const { data: template } = await supabase.from("test_templates").select("test_name").eq("id", templateId).single();
    const { data: params } = await supabase.from("test_parameters").select("*").eq("template_id", templateId);
    if (template && params) {
      setTestName(template.test_name);
      setParameters(params.map((p, idx) => ({
        id: `${idx + 1}`, name: p.parameter_name, lowerLimit: p.lower_limit?.toString() || "", upperLimit: p.upper_limit?.toString() || "",
        actualValue: "", unit: p.unit || "", particleSize: "", testMethod: (p as any).test_method || "",
      })));
    }
  };

  const addParameter = () => {
    setParameters([...parameters, { id: Date.now().toString(), name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" }]);
  };

  const removeParameter = (id: string) => setParameters(parameters.filter((p) => p.id !== id));

  const updateParameter = (id: string, field: keyof Parameter, value: string) => {
    setParameters(parameters.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const calculateStatus = (actual: number, lower?: number, upper?: number): string => {
    if (lower !== undefined && actual < lower) return "ALARM";
    if (upper !== undefined && actual > upper) return "ALARM";
    if (lower !== undefined && actual < lower * 1.1) return "ALERT";
    if (upper !== undefined && actual > upper * 0.9) return "ALERT";
    return "NORMAL";
  };

  const handleSaveTest = async () => {
    if (!testName.trim()) { toast.error("Please enter a test name"); return; }
    if (parameters.some((p) => !p.name.trim() || !p.actualValue.trim())) { toast.error("Please fill in all parameter names and actual values"); return; }
    setLoading(true);

    const finalImageUrl = await uploadImage();
    const { data: testData, error: testError } = await supabase
      .from("case_tests").insert({ case_id: caseId, test_name: testName, image_url: finalImageUrl, image_comment: imageComment || null }).select().single();

    if (testError) { toast.error("Failed to save test"); setLoading(false); return; }

    const results = parameters.map((p) => {
      const actual = parseFloat(p.actualValue);
      const lower = p.lowerLimit ? parseFloat(p.lowerLimit) : undefined;
      const upper = p.upperLimit ? parseFloat(p.upperLimit) : undefined;
      return {
        case_test_id: testData.id, parameter_name: p.name, lower_limit: lower, upper_limit: upper,
        actual_value: actual, unit: p.unit || null, particle_size: p.particleSize || null,
        test_method: p.testMethod || null, status: calculateStatus(actual, lower, upper),
      };
    });

    const { error: resultsError } = await supabase.from("case_test_results").insert(results);
    if (resultsError) {
      toast.error("Failed to save test results");
    } else {
      toast.success("Test saved successfully!");
      const addAnother = window.confirm("Add another test?");
      if (addAnother) {
        setTestName(""); setImageUrl(""); setImageComment(""); setImageFile(null); setImagePreview("");
        setParameters([{ id: "1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "", testMethod: "" }]);
        setSelectedTemplate("");
      } else {
        navigate(`/case/${caseId}/dashboard`);
      }
    }
    setLoading(false);
  };

  const saveAsTemplate_func = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: templateData, error } = await supabase.from("test_templates").insert({ user_id: user.id, test_name: testName }).select().single();
    if (error) { toast.error("Failed to save template"); return; }
    const templateParams = parameters.map((p) => ({
      template_id: templateData.id, parameter_name: p.name,
      lower_limit: p.lowerLimit ? parseFloat(p.lowerLimit) : null, upper_limit: p.upperLimit ? parseFloat(p.upperLimit) : null, unit: p.unit || null,
    }));
    const { error: paramsError } = await supabase.from("test_parameters").insert(templateParams);
    if (paramsError) toast.error("Failed to save template parameters");
    else { toast.success("Template saved!"); fetchTemplates(); }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(`/case/${caseId}`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Case
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Add Test</h1>
        <p className="text-muted-foreground mt-1">Configure test parameters and record results</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Information</CardTitle>
            <CardDescription>Enter the test name and optionally use a saved template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Use Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={(v) => { setSelectedTemplate(v); loadTemplate(v); }}>
                <SelectTrigger><SelectValue placeholder="Select a saved template" /></SelectTrigger>
                <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.test_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-name">Test Name <span className="text-destructive">*</span></Label>
              <Input id="test-name" placeholder="e.g., Viscosity Analysis" value={testName} onChange={(e) => setTestName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Test Image (Optional)</Label>
              <Input type="file" accept="image/*" onChange={handleImageSelect} className="cursor-pointer" />
              {(imagePreview || imageUrl) && <img src={imagePreview || imageUrl} alt="Preview" className="max-w-xs rounded-lg border mt-2" />}
              {uploadingImage && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Uploading...</p>}
            </div>
            {(imagePreview || imageUrl) && (
              <div className="space-y-2">
                <Label>Image Comment (Optional)</Label>
                <Input placeholder="Add a comment..." value={imageComment} onChange={(e) => setImageComment(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Test Parameters</CardTitle><CardDescription>Define parameters, limits, and actual values</CardDescription></div>
              <Button onClick={addParameter} size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Add Parameter</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parameters.map((param, index) => (
              <div key={param.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Parameter {index + 1}</span>
                  {parameters.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeParameter(param.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Parameter Name *</Label>
                    <Input placeholder="e.g., Viscosity" value={param.name} onChange={(e) => updateParameter(param.id, "name", e.target.value)} />
                  </div>
                  <div className="space-y-2"><Label>Lower Limit</Label><Input type="number" step="any" placeholder="Min" value={param.lowerLimit} onChange={(e) => updateParameter(param.id, "lowerLimit", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Upper Limit</Label><Input type="number" step="any" placeholder="Max" value={param.upperLimit} onChange={(e) => updateParameter(param.id, "upperLimit", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Unit</Label><Input placeholder="ppm, cSt" value={param.unit} onChange={(e) => updateParameter(param.id, "unit", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Particle Size</Label><Input placeholder="e.g., 4μm" value={param.particleSize} onChange={(e) => updateParameter(param.id, "particleSize", e.target.value)} /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2"><Label>Actual Value *</Label><Input type="number" step="any" placeholder="Enter measured value" value={param.actualValue} onChange={(e) => updateParameter(param.id, "actualValue", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Test Method</Label><TestMethodSelect value={param.testMethod} onChange={(v) => updateParameter(param.id, "testMethod", v)} /></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSaveTest} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {loading ? "Saving..." : "Save Test"}
        </Button>
      </div>
    </div>
  );
};

export default AddTest;
