import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import useWindowDimensions from "../core/useWindowDimensions";
import containFactor from "../core/containFactor";
import useDeviceType from "../core/useDeviceType";

export default function Container({ children }) {
  const { isLarge } = useDeviceType();

  const designWidth  = isLarge ? 1920 : 1280;
  const designHeight = isLarge ? 1080 : 800;

  return (
    <BaseContainer width={designWidth} height={designHeight}>
      {children}
    </BaseContainer>
  );
}

function BaseContainer({ width, height, children }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [factor, setFactor] = useState(1);

  useEffect(() => {
    const f = containFactor(width, height, winW, winH);
    setFactor(Math.min(1, f));
  }, [width, height, winW, winH]);

  return (
    <Box
      style={{
        transform: `scale(${factor})`,
        transformOrigin: "top left",
        width: `${width}px`,
        height: `${height}px`,
        overflow: "hidden",
        position: "absolute",
      }}
    >
      {children}
    </Box>
  );
}
