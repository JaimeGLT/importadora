namespace UsaAutoPartes.Infrastructure.Data;

public static class PostgresFunctions
{
    // Translated by EF Core to the PostgreSQL unaccent() function.
    // Requires the unaccent extension to be enabled in the database:
    //   CREATE EXTENSION IF NOT EXISTS unaccent;
    public static string Unaccent(string value)
        => throw new InvalidOperationException("This method is for EF Core LINQ translation only.");
}
