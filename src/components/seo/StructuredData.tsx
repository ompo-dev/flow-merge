interface StructuredDataProps {
  data: Array<Record<string, unknown>>;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <>
      {data.map((entry, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </>
  );
}
