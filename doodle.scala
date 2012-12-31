
import java.awt.{Container,Graphics,Graphics2D,Color,Dimension,BasicStroke,Polygon,Robot}
import java.awt.geom.Line2D
import java.awt.event.{ActionEvent,ActionListener,MouseEvent,InputEvent,KeyEvent,KeyListener}
import javax.swing.event.MouseInputListener
import javax.swing.{JComponent,JFrame,JRootPane,SwingUtilities,Timer,WindowConstants}
import java.nio.ByteBuffer
import java.nio.channels.{ServerSocketChannel,SocketChannel}
import java.net.{InetAddress,InetSocketAddress}

class Polyline( x:Int, y:Int ) extends Polygon
{
  addPoint( x, y )

  def add( x:Int, y:Int ) = {
    val p = npoints - 1
    if ( x != xpoints(p) || y != ypoints(p) )
      addPoint( x, y )
    this }

  def dot =
    add( xpoints(0)+1, ypoints(0)+1 )

  def near( x:Double, y:Double ):Boolean = {
    for ( p <- 1 until npoints )
      if ( 9 > Line2D.ptSegDistSq(
        xpoints(p-1), ypoints(p-1), xpoints(p), ypoints(p), x, y ) )
        return true
    return false }

  def draw( graphics:Graphics ) {
    graphics.drawPolyline( xpoints, ypoints, npoints ) }
}

class Devices extends Robot
{
  setAutoDelay( 100 )

  def click( button:Int ) {
    mousePress( button ) ; mouseRelease( button ) }
  def click() {
    click( InputEvent.BUTTON1_MASK ) }

  def key( code:Int ) {
    keyPress( code ) ; keyRelease( code ) }
  def key( char:Char ) {
    key( KeyEvent.getExtendedKeyCodeForChar( char ) ) }

  def visible( container:Container, value:Boolean ) {
    container.setVisible( value ) ; delay( 100 ) }

  def hideClickKeyClickShow( container:Container, char:Char ) {
    visible( container, false )
    click() ; key( char ) ; click()
    visible( container, true ) }
}

class Client( socket:SocketChannel )
{
  var lastRead = 0
  def read( buffer:ByteBuffer ) =
    if ( lastRead < 0 ) false else {
      buffer.clear()
      socket.configureBlocking( false )
      try { lastRead = socket.read( buffer ) }
      catch { case _ => lastRead = -1 }
      if ( lastRead < 0 ) {
	socket.close()
	false }
      else {
	if ( lastRead > 0 ) {
	  buffer.flip()
	  while ( buffer.hasRemaining )
	    Console.print( buffer.get.asInstanceOf[Char] )
	  Console.println() }
	true } }
  def write( buffer:ByteBuffer ) {
    buffer.rewind()
    socket.configureBlocking( true )
    try { while ( buffer.hasRemaining ) socket.write( buffer ) }
    catch { case _ => socket.close() ; lastRead = -1 } }
}

class Doodle extends JComponent
with MouseInputListener with KeyListener with ActionListener
{
  private val stroke = new BasicStroke( 2.0f )
  private var lines = List.empty[Polyline]

  private val server = ServerSocketChannel.open
    .bind( new InetSocketAddress( "127.0.0.1", 8421 ) )
  server.configureBlocking( false )
  private val buffer = ByteBuffer.allocate( 4096 )
  private var clients = List.empty[Client]
  new Timer( 1000, this ).start()
  def actionPerformed( event:ActionEvent ) {
    var accept = server.accept()
    var changed = false
    while ( accept != null ) {
      clients = new Client( accept ) :: clients
      changed = true
      accept = server.accept() }
    var (keep,drop) = clients partition { _.read( buffer ) }
    if ( drop.nonEmpty ) changed = true
    if ( changed )
      getTopLevelAncestor.asInstanceOf[JFrame].setTitle("Doodle:"+keep.size)
    clients = keep }

  private var restore:Dimension = null
  private def jiggle() {
    // some unexplained buffering of transparent window... filtered
    // doodles hang around until resize forces buffer to be cleared
    val window = getTopLevelAncestor ; restore = window.getSize
    window.setSize( restore.width, restore.height+1 ) }

  override def paintComponent( argument:Graphics ) {
    if ( restore != null ) { // 2nd part of jiggle
      getTopLevelAncestor.setSize( restore ) ; restore = null }
    val graphics = argument.asInstanceOf[Graphics2D]
    val originalStroke = graphics.getStroke
    graphics.setStroke( stroke )
    lines foreach { _.draw( graphics ) }
    graphics.setStroke( originalStroke ) }

  def mousePressed( event:MouseEvent ) {
    lines = new Polyline( event.getX, event.getY ) :: lines
    addMouseMotionListener( this ) }

  def mouseDragged( event:MouseEvent ) {
    lines.head.add( event.getX, event.getY )
    repaint() }

  def mouseReleased( event:MouseEvent ) {
    mouseDragged( event )
    if ( lines.head.npoints < 2 ) {
      val single = lines.head
      var (drop,keep) = lines.tail partition { _.near( event.getX, event.getY ) }
      lines = if ( drop.nonEmpty ) keep else single.dot :: keep
      jiggle() }
    removeMouseMotionListener( this ) }

  def mouseClicked( event:MouseEvent ) {}
  def mouseEntered( event:MouseEvent ) {}
  def mouseExited( event:MouseEvent ) {}
  def mouseMoved( event:MouseEvent ) {}
  addMouseListener( this )

  private val devices = new Devices
  def keyTyped( event:KeyEvent ) {
    event.getKeyChar match {
      case '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
          | ' ' | '\b' | '\n' =>
        devices.hideClickKeyClickShow( getTopLevelAncestor, event.getKeyChar )
      case 't' => buffer.clear()
	buffer.put('h'.toByte).put('i'.toByte).put('\n'.toByte).flip()
	clients foreach { _.write( buffer ) }
      case '-' => lines = lines.tail ; jiggle()
      case 'X' => lines = List.empty[Polyline] ; jiggle()
      case value => println("nope:"+event) } }

  def keyPressed( event:KeyEvent ) {}
  def keyReleased( event:KeyEvent ) {}
  addKeyListener( this )
  setFocusable( true )
}

object Main
{
  def main( args:Array[String] ) {
    SwingUtilities.invokeLater( new Runnable { def run {
      val frame = new JFrame( "Doodle" )
      frame.setDefaultCloseOperation( WindowConstants.EXIT_ON_CLOSE )
      frame.setUndecorated( true )
      frame.getRootPane.setWindowDecorationStyle( JRootPane.FRAME )
      frame.setBackground( new Color( 0, 0, 0, 0 ) )
      frame.getRootPane.setContentPane( new Doodle )
      frame.setSize( 400, 300 )
      frame.setVisible( true ) } } ) }
}

