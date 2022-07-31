export default function PageComponent() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <form
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          width: "500px",
          maxWidth: "100%",
          border: "1px solid gray",
          padding: "0.5rem",
        }}
        onSubmit={(e) => e.preventDefault()}
      >
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
        >
          {/* TODO: multi input? */}
          <span>Ameba ID</span>
          <input defaultValue="juicejuice-official" />
        </label>
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
        >
          {/* TODO: multi select? */}
          <span>Themes</span>
          <input />
        </label>
      </form>
    </div>
  );
}
