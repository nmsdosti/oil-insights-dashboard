import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";

type Condition = "NORMAL" | "ALERT" | "ALARM";

const NewCase = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [machineCondition, setMachineCondition] = useState<Condition>("NORMAL");
  const [lubricantCondition, setLubricantCondition] = useState<Condition>("NORMAL");

  const handleSubmit = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Please sign in to create a case");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("cases")
      .insert({
        user_id: user.id,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_mobile: customerMobile,
        customer_email: customerEmail,
        machine_condition: machineCondition,
        lubricant_condition: lubricantCondition,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create case");
      console.error(error);
    } else {
      toast.success("Case created successfully!");
      navigate(`/case/${data.id}/add-test`);
    }
    setLoading(false);
  };

  const canProceedStep1 = customerName.trim().length > 0;
  const canProceedStep2 = true; // Conditions are always set

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button variant="ghost" onClick={() => step === 1 ? navigate("/") : setStep(step - 1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {step === 1 ? "Back to Cases" : "Previous Step"}
      </Button>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">New Analysis Case</h1>
          <span className="text-sm text-muted-foreground">Step {step} of 2</span>
        </div>
        <div className="flex gap-2">
          <div className={`h-1 flex-1 rounded ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
            <CardDescription>Enter the customer information for this analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                placeholder="Enter address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-mobile">Mobile Number</Label>
              <Input
                id="customer-mobile"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full mt-6">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Condition Assessment</CardTitle>
            <CardDescription>Evaluate the current machine and lubricant conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Machine Condition</Label>
              <RadioGroup value={machineCondition} onValueChange={(value) => setMachineCondition(value as Condition)}>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="NORMAL" id="machine-normal" />
                  <Label htmlFor="machine-normal" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-success">NORMAL</div>
                      <div className="text-sm text-muted-foreground">Machine is operating within normal parameters</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ALERT" id="machine-alert" />
                  <Label htmlFor="machine-alert" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-warning">ALERT</div>
                      <div className="text-sm text-muted-foreground">Machine requires attention</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ALARM" id="machine-alarm" />
                  <Label htmlFor="machine-alarm" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-destructive">ALARM</div>
                      <div className="text-sm text-muted-foreground">Critical machine condition</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Lubricant Condition</Label>
              <RadioGroup value={lubricantCondition} onValueChange={(value) => setLubricantCondition(value as Condition)}>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="NORMAL" id="lubricant-normal" />
                  <Label htmlFor="lubricant-normal" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-success">NORMAL</div>
                      <div className="text-sm text-muted-foreground">Lubricant is in good condition</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ALERT" id="lubricant-alert" />
                  <Label htmlFor="lubricant-alert" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-warning">ALERT</div>
                      <div className="text-sm text-muted-foreground">Lubricant degradation detected</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="ALARM" id="lubricant-alarm" />
                  <Label htmlFor="lubricant-alarm" className="flex-1 cursor-pointer font-normal">
                    <div>
                      <div className="font-medium text-destructive">ALARM</div>
                      <div className="text-sm text-muted-foreground">Critical lubricant condition</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleSubmit} disabled={!canProceedStep2 || loading} className="w-full mt-6">
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Creating Case..." : "Create Case & Add Tests"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewCase;
