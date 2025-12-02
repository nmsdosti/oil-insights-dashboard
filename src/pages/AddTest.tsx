import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Upload } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Parameter {
  id: string;
  name: string;
  lowerLimit: string;
  upperLimit: string;
  actualValue: string;
  unit: string;
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
  const [parameters, setParameters] = useState<Parameter[]>([
    { id: "1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "" },
  ]);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from("test_templates").select("*");

    if (error) {
      console.error("Error fetching templates:", error);
    } else {
      setTemplates(data || []);
    }
  };

  const loadTemplate = async (templateId: string) => {
    const { data: template } = await supabase
      .from("test_templates")
      .select("test_name")
      .eq("id", templateId)
      .single();

    const { data: params } = await supabase
      .from("test_parameters")
      .select("*")
      .eq("template_id", templateId);

    if (template && params) {
      setTestName(template.test_name);
      setParameters(
        params.map((p, idx) => ({
          id: `${idx + 1}`,
          name: p.parameter_name,
          lowerLimit: p.lower_limit?.toString() || "",
          upperLimit: p.upper_limit?.toString() || "",
          actualValue: "",
          unit: p.unit || "",
        }))
      );
    }
  };

  const addParameter = () => {
    setParameters([
      ...parameters,
      { id: Date.now().toString(), name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "" },
    ]);
  };

  const removeParameter = (id: string) => {
    setParameters(parameters.filter((p) => p.id !== id));
  };

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
    if (!testName.trim()) {
      toast.error("Please enter a test name");
      return;
    }

    if (parameters.some((p) => !p.name.trim() || !p.actualValue.trim())) {
      toast.error("Please fill in all parameter names and actual values");
      return;
    }

    setLoading(true);

    const { data: testData, error: testError } = await supabase
      .from("case_tests")
      .insert({
        case_id: caseId,
        test_name: testName,
        image_url: imageUrl || null,
      })
      .select()
      .single();

    if (testError) {
      toast.error("Failed to save test");
      console.error(testError);
      setLoading(false);
      return;
    }

    const results = parameters.map((p) => {
      const actual = parseFloat(p.actualValue);
      const lower = p.lowerLimit ? parseFloat(p.lowerLimit) : undefined;
      const upper = p.upperLimit ? parseFloat(p.upperLimit) : undefined;

      return {
        case_test_id: testData.id,
        parameter_name: p.name,
        lower_limit: lower,
        upper_limit: upper,
        actual_value: actual,
        unit: p.unit || null,
        status: calculateStatus(actual, lower, upper),
      };
    });

    const { error: resultsError } = await supabase.from("case_test_results").insert(results);

    if (resultsError) {
      toast.error("Failed to save test results");
      console.error(resultsError);
    } else {
      toast.success("Test saved successfully!");
      
      // Ask user if they want to save as template
      const saveAsTemplate = window.confirm("Would you like to save this test configuration as a template for future use?");
      
      if (saveAsTemplate) {
        await saveAsTemplate_func();
      }
      
      // Ask if user wants to add another test
      const addAnother = window.confirm("Test saved! Would you like to add another test?");
      if (addAnother) {
        // Reset form
        setTestName("");
        setImageUrl("");
        setParameters([{ id: "1", name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "" }]);
        setSelectedTemplate("");
      } else {
        navigate(`/case/${caseId}/dashboard`);
      }
    }

    setLoading(false);
  };

  const saveAsTemplate_func = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: templateData, error: templateError } = await supabase
      .from("test_templates")
      .insert({
        user_id: user.id,
        test_name: testName,
      })
      .select()
      .single();

    if (templateError) {
      toast.error("Failed to save template");
      return;
    }

    const templateParams = parameters.map((p) => ({
      template_id: templateData.id,
      parameter_name: p.name,
      lower_limit: p.lowerLimit ? parseFloat(p.lowerLimit) : null,
      upper_limit: p.upperLimit ? parseFloat(p.upperLimit) : null,
      unit: p.unit || null,
    }));

    const { error: paramsError } = await supabase.from("test_parameters").insert(templateParams);

    if (paramsError) {
      toast.error("Failed to save template parameters");
    } else {
      toast.success("Template saved successfully!");
      fetchTemplates();
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(`/case/${caseId}`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Case
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
              <Select
                value={selectedTemplate}
                onValueChange={(value) => {
                  setSelectedTemplate(value);
                  loadTemplate(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a saved template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.test_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-name">
                Test Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="test-name"
                placeholder="e.g., Viscosity Analysis, Wear Metals Test"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-url">Test Image URL (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.jpg or imgbb.com link"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button variant="outline" size="icon" onClick={() => window.open("https://imgbb.com/", "_blank")}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Upload your image to imgbb.com and paste the link here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Test Parameters</CardTitle>
                <CardDescription>Define parameters, limits, and actual values</CardDescription>
              </div>
              <Button onClick={addParameter} size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Parameter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parameters.map((param, index) => (
              <div key={param.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Parameter {index + 1}</span>
                  {parameters.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeParameter(param.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Parameter Name *</Label>
                    <Input
                      placeholder="e.g., Viscosity, Iron"
                      value={param.name}
                      onChange={(e) => updateParameter(param.id, "name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lower Limit</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Min"
                      value={param.lowerLimit}
                      onChange={(e) => updateParameter(param.id, "lowerLimit", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Upper Limit</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Max"
                      value={param.upperLimit}
                      onChange={(e) => updateParameter(param.id, "upperLimit", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input
                      placeholder="ppm, cSt"
                      value={param.unit}
                      onChange={(e) => updateParameter(param.id, "unit", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Actual Value *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Enter measured value"
                    value={param.actualValue}
                    onChange={(e) => updateParameter(param.id, "actualValue", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSaveTest} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {loading ? "Saving..." : "Save Test"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddTest;
