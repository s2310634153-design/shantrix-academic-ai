import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileCheck } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <FileCheck className="h-6 w-6 text-accent" />
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Shantrix
          </span>
        </Link>
        
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-accent hover:bg-accent/90">Sign Up</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
