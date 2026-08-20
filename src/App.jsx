import { Box } from "@mui/material";
import Container from "./components/Container";
import GameFlow from "./GameFlow";

export default function App() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Container>
        <GameFlow />
      </Container>
    </Box>
  );
}