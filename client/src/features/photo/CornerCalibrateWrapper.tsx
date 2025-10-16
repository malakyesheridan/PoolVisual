import { useTransformMode } from "./context/TransformContext";
import CornerCalibrate from "./CornerCalibrate";

export default function CornerCalibrateWrapper() {
  const { calibrateMode } = useTransformMode();
  
  if (!calibrateMode) return null;
  
  return <CornerCalibrate />;
}
