import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  link?: string;
}

export default function ServiceCard({
  icon: Icon,
  title,
  description,
  gradient,
}: ServiceCardProps) {
  return (
    <Card className="group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 cursor-pointer">
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity", gradient)} />
      
      <CardContent className="p-6 relative z-10">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4", gradient)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
