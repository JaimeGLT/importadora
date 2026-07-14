using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;
using UsaAutoPartes.Application.IServicios;
using UsaAutoPartes.Domain.Entities;
using UsaAutoPartes.Infrastructure.Data;

namespace UsaAutoPartes.Infrastructure.Servicios.Processors
{
    public class ExportProductoServicio(AppDbContext _db) : IExportProductoServicio
    {
        public async Task<byte[]> GenerarExcelInventario()
        {
            var productos = await _db.Set<Producto>()
                .Where(x => x.Activo)
                .Include(x => x.Marca)
                .OrderBy(x => x.Nombre)
                .AsNoTracking()
                .ToListAsync();

            ExcelPackage.License.SetNonCommercialOrganization("UsaAutoPartes");

            using var package = new ExcelPackage();
            var ws = package.Workbook.Worksheets.Add("Inventario");

            string[] headers =
            [
                "Código", "Cód. Alt. 1", "Cód. Alt. 2", "Nombre", "Marca",
                "Unidad", "Stock Actual", "Stock Reservado", "Stock Mínimo",
                "Precio Costo (Bs)", "Precio Venta (Bs)", "Margen (%)",
                "Ubicación", "Es Kit", "Descripción", "Fecha Creación"
            ];

            for (int col = 1; col <= headers.Length; col++)
                ws.Cells[1, col].Value = headers[col - 1];

            var headerRange = ws.Cells[1, 1, 1, headers.Length];
            headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
            headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(0x1E, 0x3A, 0x5F));
            headerRange.Style.Font.Color.SetColor(Color.White);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Font.Size = 11;
            headerRange.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
            headerRange.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
            SetBorder(headerRange, ExcelBorderStyle.Thin, Color.FromArgb(0x2A, 0x4A, 0x6F));
            ws.Row(1).Height = 20;

            var altRowColor = Color.FromArgb(0xEF, 0xF4, 0xFB);

            for (int i = 0; i < productos.Count; i++)
            {
                int row = i + 2;
                var p = productos[i];

                decimal margen = p.Costo > 0
                    ? Math.Round((p.Precio - p.Costo) / p.Costo * 100, 1)
                    : 0;

                ws.Cells[row, 1].Value  = p.Codigo;
                ws.Cells[row, 2].Value  = p.CodigoAux;
                ws.Cells[row, 3].Value  = p.CodigoAux2;
                ws.Cells[row, 4].Value  = p.Nombre;
                ws.Cells[row, 5].Value  = p.Marca?.Nombre ?? string.Empty;
                ws.Cells[row, 6].Value  = p.Unidad_Medida;
                ws.Cells[row, 7].Value  = p.Stock_Actual;
                ws.Cells[row, 8].Value  = p.StockReservado;
                ws.Cells[row, 9].Value  = p.Stock_Minimo;
                ws.Cells[row, 10].Value = p.Costo;
                ws.Cells[row, 11].Value = p.Precio;
                ws.Cells[row, 12].Value = (double)margen;
                ws.Cells[row, 13].Value = p.Ubicacion;
                ws.Cells[row, 14].Value = p.EsKit ? "Sí" : "No";
                ws.Cells[row, 15].Value = p.Descripcion;
                ws.Cells[row, 16].Value = p.FechaCreacion.ToString("dd/MM/yyyy");

                ws.Cells[row, 7, row, 9].Style.Numberformat.Format   = "#,##0";
                ws.Cells[row, 10, row, 11].Style.Numberformat.Format = "#,##0.00";
                ws.Cells[row, 12].Style.Numberformat.Format           = "0.0";

                if (i % 2 == 1)
                {
                    var rowRange = ws.Cells[row, 1, row, headers.Length];
                    rowRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                    rowRange.Style.Fill.BackgroundColor.SetColor(altRowColor);
                }

                SetBorder(ws.Cells[row, 1, row, headers.Length], ExcelBorderStyle.Thin, Color.FromArgb(0xD0, 0xCB, 0xC4));
            }

            ws.Cells[ws.Dimension.Address].AutoFitColumns(8, 42);
            ws.View.FreezePanes(2, 1);

            return package.GetAsByteArray();
        }

        private static void SetBorder(ExcelRange range, ExcelBorderStyle style, Color color)
        {
            range.Style.Border.Top.Style    = style;
            range.Style.Border.Bottom.Style = style;
            range.Style.Border.Left.Style   = style;
            range.Style.Border.Right.Style  = style;
            range.Style.Border.Top.Color.SetColor(color);
            range.Style.Border.Bottom.Color.SetColor(color);
            range.Style.Border.Left.Color.SetColor(color);
            range.Style.Border.Right.Color.SetColor(color);
        }
    }
}
