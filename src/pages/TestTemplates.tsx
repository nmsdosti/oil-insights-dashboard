import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, FlaskConical, Edit, X } from "lucide-react";
import TestMethodSelect from "@/components/TestMethodSelect";

interface TemplateParam {
  id: string;
  dbId?: string;
  name: string;
  lowerLimit: string;
  upperLimit: string;
  unit: string;
  testMethod: string;
}

interface Template {
  id: string;
  dbId?: string;
  test_name: string;
  parameters: TemplateParam[];
  isDirty?: boolean;
  isNew?: boolean;
}

const TestTemplates = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParams, setNewParams] = useState<TemplateParam[]>([
    { id: "1", name: "", lowerLimit: "", upperLimit: "", unit: "", testMethod: "" },
  ]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("test_templates")
      .select(`id, test_name, test_parameters (id, parameter_name, lower_limit, upper_limit, unit, test_method)`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load templates");
    } else {
      setTemplates(
        (data || []).map((t: any) => ({
          id: t.id,
          dbId: t.id,
          test_name: t.test_name,
          parameters: (t.test_parameters || []).map((p: any) => ({
            id: p.id,
            dbId: p.id,
            name: p.parameter_name,
            lowerLimit: p.lower_limit?.toString() || "",
            upperLimit: p.upper_limit?.toString() || "",
            unit: p.unit || "",
            testMethod: p.test_method || "",
          })),
        }))
      );
    }
    setLoading(false);
  };

  // --- Editing existing templates ---
  const updateTemplateName = (id: string, name: string) => {
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, test_name: name, isDirty: true } : t));
  };

  const updateParam = (templateId: string, paramId: string, field: keyof TemplateParam, value: string) => {
    setTemplates(ts => ts.map(t => t.id === templateId ? {
      ...t, isDirty: true,
      parameters: t.parameters.map(p => p.id === paramId ? { ...p, [field]: value } : p),
    } : t));
  };

  const addParamToTemplate = (templateId: string) => {
    setTemplates(ts => ts.map(t => t.id === templateId ? {
      ...t, isDirty: true,
      parameters: [...t.parameters, { id: `new-${Date.now()}`, name: "", lowerLimit: "", upperLimit: "", unit: "", testMethod: "" }],
    } : t));
  };

  const removeParamFromTemplate = (templateId: string, paramId: string) => {
    setTemplates(ts => ts.map(t => t.id === templateId ? {
      ...t, isDirty: true,
      parameters: t.parameters.filter(p => p.id !== paramId),
    } : t));
  };

  const saveTemplate = async (template: Template) => {
    if (!template.test_name.trim()) { toast.error("Template name is required"); return; }
    if (template.parameters.some(p => !p.name.trim())) { toast.error("All parameter names are required"); return; }

    setSaving(template.id);

    // Update template name
    const { error: nameErr } = await supabase.from("test_templates").update({ test_name: template.test_name }).eq("id", template.dbId!);
    if (nameErr) { toast.error("Failed to update template"); setSaving(null); return; }

    // Delete existing params and re-insert
    await supabase.from("test_parameters").delete().eq("template_id", template.dbId!);
    const params = template.parameters.map(p => ({
      template_id: template.dbId!,
      parameter_name: p.name,
      lower_limit: p.lowerLimit ? parseFloat(p.lowerLimit) : null,
      upper_limit: p.upperLimit ? parseFloat(p.upperLimit) : null,
      unit: p.unit || null,
      test_method: p.testMethod || null,
    }));

    const { error: pErr } = await supabase.from("test_parameters").insert(params);
    if (pErr) toast.error("Failed to save parameters");
    else {
      toast.success(`"${template.test_name}" saved!`);
      fetchTemplates();
    }
    setSaving(null);
  };

  const deleteTemplate = async (template: Template) => {
    if (!confirm(`Delete template "${template.test_name}" and all its parameters?`)) return;
    await supabase.from("test_parameters").delete().eq("template_id", template.dbId!);
    const { error } = await supabase.from("test_templates").delete().eq("id", template.dbId!);
    if (error) toast.error("Failed to delete template");
    else {
      toast.success("Template deleted");
      setTemplates(ts => ts.filter(t => t.id !== template.id));
    }
  };

  // --- Adding new template ---
  const handleAddTemplate = async () => {
    if (!newName.trim()) { toast.error("Enter a template name"); return; }
    if (newParams.some(p => !p.name.trim())) { toast.error("All parameter names are required"); return; }

    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in"); setAdding(false); return; }

    const { data: tmpl, error: tErr } = await supabase.from("test_templates")
      .insert({ user_id: user.id, test_name: newName }).select().single();

    if (tErr || !tmpl) { toast.error("Failed to create template"); setAdding(false); return; }

    const params = newParams.map(p => ({
      template_id: tmpl.id,
      parameter_name: p.name,
      lower_limit: p.lowerLimit ? parseFloat(p.lowerLimit) : null,
      upper_limit: p.upperLimit ? parseFloat(p.upperLimit) : null,
      unit: p.unit || null,
      test_method: p.testMethod || null,
    }));

    const { error: pErr } = await supabase.from("test_parameters").insert(params);
    if (pErr) toast.error("Failed to save parameters");
    else {
      toast.success("Template created!");
      setShowNew(false);
      setNewName("");
      setNewParams([{ id: "1", name: "", lowerLimit: "", upperLimit: "", unit: "", testMethod: "" }]);
      fetchTemplates();
    }
    setAdding(false);
  };

  const addNewParam = () => {
    setNewParams([...newParams, { id: `${Date.now()}`, name: "", lowerLimit: "", upperLimit: "", unit: "", testMethod: "" }]);
  };

  const updateNewParam = (id: string, field: keyof TemplateParam, value: string) => {
    setNewParams(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeNewParam = (id: string) => {
    setNewParams(ps => ps.filter(p => p.id !== id));
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            Default Tests
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage default test templates. Select these when adding tests to a case.
          </p>
        </div>
        <Button onClick={() => setShowNew(!showNew)}>
          {showNew ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showNew ? "Cancel" : "New Template"}
        </Button>
      </div>

      {/* New Template Form */}
      {showNew && (
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Create New Test Template</CardTitle>
            <CardDescription>Define a default test with parameters and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g., Viscosity Analysis" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Parameters</h4>
              <Button size="sm" variant="outline" onClick={addNewParam}><Plus className="mr-1 h-3 w-3" />Add Parameter</Button>
            </div>

            {newParams.map((param, idx) => (
              <div key={param.id} className="rounded-lg border border-border p-3 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Parameter {idx + 1}</span>
                  {newParams.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewParam(param.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-5">
                  <Input placeholder="Parameter Name *" value={param.name} onChange={e => updateNewParam(param.id, "name", e.target.value)} className="text-sm" />
                  <Input type="number" step="any" placeholder="Lower Limit" value={param.lowerLimit} onChange={e => updateNewParam(param.id, "lowerLimit", e.target.value)} className="text-sm" />
                  <Input type="number" step="any" placeholder="Upper Limit" value={param.upperLimit} onChange={e => updateNewParam(param.id, "upperLimit", e.target.value)} className="text-sm" />
                  <Input placeholder="Unit (ppm, cSt...)" value={param.unit} onChange={e => updateNewParam(param.id, "unit", e.target.value)} className="text-sm" />
                  <TestMethodSelect value={param.testMethod} onChange={v => updateNewParam(param.id, "testMethod", v)} />
                </div>
              </div>
            ))}

            <Button onClick={handleAddTemplate} disabled={adding} className="w-full">
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {adding ? "Creating..." : "Create Template"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing Templates */}
      {templates.length === 0 && !showNew ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No Test Templates Yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">Create default tests that you can reuse across cases.</p>
            <Button onClick={() => setShowNew(true)}><Plus className="mr-2 h-4 w-4" />Create First Template</Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {templates.map(template => (
            <AccordionItem key={template.id} value={template.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{template.test_name}</span>
                  <span className="text-xs text-muted-foreground">({template.parameters.length} params)</span>
                  {template.isDirty && <span className="text-xs text-amber-500 font-medium">• unsaved</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 pb-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={template.test_name} onChange={e => updateTemplateName(template.id, e.target.value)} />
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Parameters</h4>
                  <Button size="sm" variant="outline" onClick={() => addParamToTemplate(template.id)}>
                    <Plus className="mr-1 h-3 w-3" />Add
                  </Button>
                </div>

                {template.parameters.map((param, idx) => (
                  <div key={param.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Parameter {idx + 1}</span>
                      {template.parameters.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeParamFromTemplate(template.id, param.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-5">
                      <Input placeholder="Parameter Name *" value={param.name} onChange={e => updateParam(template.id, param.id, "name", e.target.value)} className="text-sm" />
                      <Input type="number" step="any" placeholder="Lower Limit" value={param.lowerLimit} onChange={e => updateParam(template.id, param.id, "lowerLimit", e.target.value)} className="text-sm" />
                      <Input type="number" step="any" placeholder="Upper Limit" value={param.upperLimit} onChange={e => updateParam(template.id, param.id, "upperLimit", e.target.value)} className="text-sm" />
                      <Input placeholder="Unit" value={param.unit} onChange={e => updateParam(template.id, param.id, "unit", e.target.value)} className="text-sm" />
                      <TestMethodSelect value={param.testMethod} onChange={v => updateParam(template.id, param.id, "testMethod", v)} />
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-2">
                  <Button onClick={() => saveTemplate(template)} disabled={saving === template.id} className="flex-1">
                    {saving === template.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving === template.id ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteTemplate(template)}>
                    <Trash2 className="mr-2 h-4 w-4" />Delete
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

export default TestTemplates;
