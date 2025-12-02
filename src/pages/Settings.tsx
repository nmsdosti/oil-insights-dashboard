import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Loader2, Building2 } from "lucide-react";

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("Oil Analysis Company");
  const [logoUrl, setLogoUrl] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("company_settings").select("*").single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setCompanyName(data.company_name);
      setLogoUrl(data.logo_url || "");
      setContactNumber(data.contact_number || "");
      setEmail(data.email || "");
      setAddress(data.address || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Please sign in to save settings");
      setSaving(false);
      return;
    }

    const settingsData = {
      user_id: user.id,
      company_name: companyName,
      logo_url: logoUrl || null,
      contact_number: contactNumber || null,
      email: email || null,
      address: address || null,
    };

    const { error } = await supabase
      .from("company_settings")
      .upsert(settingsData, { onConflict: "user_id" });

    if (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } else {
      toast.success("Settings saved successfully!");
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
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your company information for reports</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Company Information</CardTitle>
          </div>
          <CardDescription>This information will appear on all generated reports and dashboards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company-name"
              placeholder="Your Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-url">Company Logo URL</Label>
            <Input
              id="logo-url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Upload your logo to an image hosting service and paste the URL here
            </p>
            {logoUrl && (
              <div className="mt-4 p-4 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <img src={logoUrl} alt="Logo preview" className="h-16 object-contain" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  toast.error("Failed to load logo image");
                }} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-number">Contact Number</Label>
            <Input
              id="contact-number"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Business Address</Label>
            <Input
              id="address"
              placeholder="123 Main Street, City, State, ZIP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} disabled={saving || !companyName.trim()} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
