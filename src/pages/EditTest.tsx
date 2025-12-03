import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Parameter {
  id: string;
  name: string;
  lowerLimit: string;
  upperLimit: string;
  actualValue: string;
  unit: string;
  particleSize: string;
}

const EditTest = () => {
  const { caseId, testId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testName, setTestName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageComment, setImageComment] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([]);

  useEffect(() => {
    fetchTestData();
  }, [testId]);

  const fetchTestData = async () => {
    // Fetch test info
    const { data: testData, error: testError } = await supabase
      .from("case_tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (testError) {
      toast.error("Failed to load test data");
      console.error(testError);
      return;
    }

    setTestName(testData.test_name);
    setImageUrl(testData.image_url || "");
    setImageComment(testData.image_comment || "");

    // Fetch test results
    const { data: results, error: resultsError } = await supabase
      .from("case_test_results")
      .select("*")
      .eq("case_test_id", testId);

    if (resultsError) {
      toast.error("Failed to load test results");
      console.error(resultsError);
    } else {
      setParameters(
        results.map((r, idx) => ({
          id: r.id,
          name: r.parameter_name,
          lowerLimit: r.lower_limit?.toString() || "",
          upperLimit: r.upper_limit?.toString() || "",
          actualValue: r.actual_value?.toString() || "",
          unit: r.unit || "",
          particleSize: r.particle_size || "",
        }))
      );
    }

    setLoading(false);
  };

  const addParameter = () => {
    setParameters([
      ...parameters,
      { id: Date.now().toString(), name: "", lowerLimit: "", upperLimit: "", actualValue: "", unit: "", particleSize: "" },
    ]);
  };

  const removeParameter = async (id: string) => {
    // If it's an existing parameter (UUID), delete from DB
    if (id.length > 20) {
      const { error } = await supabase.from("case_test_results").delete().eq("id", id);
      if (error) {
        toast.error("Failed to delete parameter");
        return;
      }
    }
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

  const handleSave = async () => {
    if (!testName.trim()) {
      toast.error("Please enter a test name");
      return;
    }

    if (parameters.some((p) => !p.name.trim() || !p.actualValue.trim())) {
      toast.error("Please fill in all parameter names and actual values");
      return;
    }

    setSaving(true);

    // Update test info
    const { error: testError } = await supabase
      .from("case_tests")
      .update({
        test_name: testName,
        image_url: imageUrl || null,
        image_comment: imageComment || null,
      })
      .eq("id", testId);

    if (testError) {
      toast.error("Failed to update test");
      console.error(testError);
      setSaving(false);
      return;
    }

    // Delete all existing results and insert new ones
    await supabase.from("case_test_results").delete().eq("case_test_id", testId);

    const results = parameters.map((p) => {
      const actual = parseFloat(p.actualValue);
      const lower = p.lowerLimit ? parseFloat(p.lowerLimit) : undefined;
      const upper = p.upperLimit ? parseFloat(p.upperLimit) : undefined;

      return {
        case_test_id: testId,
        parameter_name: p.name,
        lower_limit: lower,
        upper_limit: upper,
        actual_value: actual,
        unit: p.unit || null,
        particle_size: p.particleSize || null,
        status: calculateStatus(actual, lower, upper),
      };
    });

    const { error: resultsError } = await supabase.from("case_test_results").insert(results);

    if (resultsError) {
      toast.error("Failed to update test results");
      console.error(resultsError);
    } else {
      toast.success("Test updated successfully!");
      navigate(`/case/${caseId}/dashboard`);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(`/case/${caseId}/dashboard`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Test</h1>
        <p className="text-muted-foreground mt-1">Modify test parameters and values</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Information</CardTitle>
            <CardDescription>Update the test name and image</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            {imageUrl && (
              <div className="space-y-2">
                <Label htmlFor="image-comment">Image Comment (Optional)</Label>
                <Input
                  id="image-comment"
                  placeholder="Add a comment about this particle image..."
                  value={imageComment}
                  onChange={(e) => setImageComment(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Test Parameters</CardTitle>
                <CardDescription>Modify parameters, limits, and actual values</CardDescription>
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

                <div className="grid gap-3 md:grid-cols-6">
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

                  <div className="space-y-2">
                    <Label>Particle Size</Label>
                    <Input
                      placeholder="e.g., 4μm"
                      value={param.particleSize}
                      onChange={(e) => updateParameter(param.id, "particleSize", e.target.value)}
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
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditTest;
