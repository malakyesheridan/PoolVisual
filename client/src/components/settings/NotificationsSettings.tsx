import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell } from "lucide-react";

export function NotificationsSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage your notification settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-slate-500">
          <p>Notification settings coming soon...</p>
        </div>
      </CardContent>
    </Card>
  );
}

