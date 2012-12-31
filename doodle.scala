
import java.awt._
import java.awt.event._
import java.awt.image._
import javax.swing._
import javax.swing.event._

object Main
{
  def main( args:Array[String] ) {
    SwingUtilities.invokeLater( new Runnable {
      def run { new Doodle } } ) }
}

class Devices extends Robot
{
  setAutoDelay( 200 )

  def click( button:Int ) {
    mousePress( button ) ; mouseRelease( button ) }
  def click() {
    click( InputEvent.BUTTON1_MASK ) }

  def key( code:Int ) {
    keyPress( code ) ; keyRelease( code ) }
  def key( event:KeyEvent ) {
    key( event.getKeyCode ) }

  def visible( component:Component, value:Boolean ) {
    component.setVisible( value ) }

  def state( frame:Frame, value:Int ) {
    frame.setState( value ) }

  def hideClickKeyClickShow( event:KeyEvent ) {
    visible( event.getComponent, false )
    click() ; key( event ) ; click()
    visible( event.getComponent, true ) }

  def hideCaptureRestore( frame:Frame, area:Rectangle ) = {
    state( frame, Frame.ICONIFIED )
    delay( 300 ) // to let the zooming animation get out of the way
    val image = createScreenCapture( area )
    state( frame, Frame.NORMAL )
    image }
}

class Doodle extends JFrame( "Doodle" )
{
  frame =>

  // redirect our content pane's paint requests to a method defined below...
  getRootPane.setContentPane( new JComponent {
    override def paintComponent( graphics:Graphics ) {
      frame.paintOurContentPane( graphics.asInstanceOf[Graphics2D] ) } } )

  // resizes always repaint, so ensure frame moves aren't optimized away...
  addComponentListener( new ComponentAdapter {
    override def componentMoved( evt:ComponentEvent ) {
      frame.getRootPane.getContentPane.repaint() } } )

  private val devices = new Devices
  private val obscuredArea = new Rectangle
  private var capturedArea:Rectangle = null
  private var capturedImage:BufferedImage = null
  private var capturedDraw:Graphics2D = null

  def paintOurContentPane( graphics:Graphics2D ) {
    val content = getRootPane.getContentPane
    content.getBounds( obscuredArea )
    obscuredArea.setLocation( content.getLocationOnScreen )
    if ( obscuredArea != capturedArea ) {
      SwingUtilities.invokeLater( recapture ) }
    if ( capturedImage != null )
      graphics.drawImage( capturedImage, 0, 0, null ) }

  private val recapture = new Runnable {
    def run() {
      capturedImage = devices.hideCaptureRestore( frame, obscuredArea )
      capturedArea = new Rectangle( obscuredArea )
      capturedDraw = capturedImage.createGraphics
      capturedDraw.setStroke( new BasicStroke( 2.0f ) )
      capturedDraw.drawRect( 0, 0, capturedArea.width, capturedArea.height )
      capturedDraw.setColor( Color.BLACK )
      capturedDraw.translate( offset.x, offset.y ) } }

  addKeyListener( new KeyAdapter {
    override def keyPressed( evt:KeyEvent ) {
      devices.hideClickKeyClickShow( evt ) } } )

  addMouseListener( new MouseInputAdapter() {
    listener =>
    private var pvx:Int = 0
    private var pvy:Int = 0
    override def mousePressed( evt:MouseEvent ) {
      pvx = evt.getX ; pvy = evt.getY
      frame.addMouseMotionListener( listener ) }
    override def mouseReleased( evt:MouseEvent ) {
      mouseDragged( evt )
      frame.removeMouseMotionListener( listener ) }
    override def mouseDragged( evt:MouseEvent ) {
      val nwx = evt.getX ; val nwy = evt.getY
      if ( nwx != pvx || nwy != pvy ) {
	if ( capturedDraw != null ) {
	  capturedDraw.drawLine( pvx, pvy, nwx, nwy )
	  repaint() }
	pvx = nwx ; pvy = nwy } }
    }
   )

  setDefaultCloseOperation( WindowConstants.DISPOSE_ON_CLOSE )
  override def getPreferredSize = new Dimension( 400, 300 )
  pack() ; setVisible( true )

  private val offset =
    SwingUtilities.convertPoint( frame, 0, 0, getRootPane.getContentPane )

}

