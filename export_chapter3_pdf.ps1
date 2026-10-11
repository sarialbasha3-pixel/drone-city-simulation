$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("D:\G-P\Chapter_3_Methodology.docx")
$pages = $doc.ComputeStatistics(2) # 2 = wdStatisticPages
Write-Output "Total Document Pages: $pages"
$doc.SaveAs("D:\G-P\Chapter_3_Methodology.pdf", 17) # 17 = wdFormatPDF
$doc.Close()
$word.Quit()
Write-Output "PDF conversion finished successfully."
