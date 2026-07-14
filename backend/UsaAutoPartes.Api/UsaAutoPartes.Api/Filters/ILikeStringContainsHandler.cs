using HotChocolate.Data.Filters;
using HotChocolate.Data.Filters.Expressions;
using HotChocolate.Language;
using HotChocolate.Types;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;
using UsaAutoPartes.Infrastructure.Data;

namespace UsaAutoPartes.Api.Filters;

public sealed class ILikeStringContainsHandler : QueryableStringOperationHandler
{
    private static readonly MethodInfo _iLike =
        typeof(NpgsqlDbFunctionsExtensions).GetMethod(
            nameof(NpgsqlDbFunctionsExtensions.ILike),
            [typeof(DbFunctions), typeof(string), typeof(string)])
        ?? throw new InvalidOperationException("ILike method not found on NpgsqlDbFunctionsExtensions.");

    private static readonly MethodInfo _unaccent =
        typeof(PostgresFunctions).GetMethod(nameof(PostgresFunctions.Unaccent), [typeof(string)])
        ?? throw new InvalidOperationException("Unaccent method not found on PostgresFunctions.");

    private static readonly MemberExpression _efFunctions =
        Expression.Property(null, typeof(EF), nameof(EF.Functions));

    public ILikeStringContainsHandler(InputParser inputParser) : base(inputParser) { }

    protected override int Operation => DefaultFilterOperations.Contains;

    public override Expression HandleOperation(
        QueryableFilterContext context,
        IFilterOperationField field,
        IValueNode value,
        object? parsedValue)
    {
        var property = context.GetInstance();

        if (parsedValue is string str)
        {
            // unaccent(column) ILIKE '%normalized_pattern%'
            // - unaccent removes accents from stored values
            // - ILIKE is case-insensitive
            // - Pattern accents removed on .NET side
            var unaccentedColumn = Expression.Call(_unaccent, property);
            var pattern = $"%{RemoveAccents(str)}%";

            return Expression.Call(
                _iLike,
                _efFunctions,
                unaccentedColumn,
                Expression.Constant(pattern));
        }

        return Expression.Constant(false);
    }

    private static string RemoveAccents(string input)
    {
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
