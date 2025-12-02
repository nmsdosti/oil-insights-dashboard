import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Case {
  id: string;
  customer_name: string;
  customer_email: string;
  machine_condition: "NORMAL" | "ALERT" | "ALARM";
  lubricant_condition: "NORMAL" | "ALERT" | "ALARM";
  created_at: string;
}

const Cases = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching cases:", error);
    } else {
      setCases((data as Case[]) || []);
    }
    setLoading(false);
  };

  const getConditionVariant = (condition: string) => {
    switch (condition) {
      case "NORMAL":
        return "default";
      case "ALERT":
        return "secondary";
      case "ALARM":
        return "destructive";
      default:
        return "default";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "NORMAL":
        return "text-success";
      case "ALERT":
        return "text-warning";
      case "ALARM":
        return "text-destructive";
      default:
        return "text-muted-foreground";
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analysis Cases</h1>
          <p className="text-muted-foreground mt-1">Manage and review all oil analysis reports</p>
        </div>
        <Button asChild>
          <Link to="/new-case">
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Link>
        </Button>
      </div>

      {cases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No cases yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first analysis case to start tracking oil test results and generating reports
            </p>
            <Button asChild>
              <Link to="/new-case">
                <Plus className="mr-2 h-4 w-4" />
                Create First Case
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Link key={caseItem.id} to={`/case/${caseItem.id}`}>
              <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{caseItem.customer_name}</CardTitle>
                      {caseItem.customer_email && (
                        <CardDescription className="mt-1">{caseItem.customer_email}</CardDescription>
                      )}
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Machine:</span>
                      <Badge variant={getConditionVariant(caseItem.machine_condition)}>
                        {caseItem.machine_condition}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lubricant:</span>
                      <Badge variant={getConditionVariant(caseItem.lubricant_condition)}>
                        {caseItem.lubricant_condition}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                      Created {format(new Date(caseItem.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cases;
