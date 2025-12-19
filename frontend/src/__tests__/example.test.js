/**
 * Example test to verify test infrastructure is working
 * This file can be removed once real tests are written
 */

describe('Example Test Suite', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have jest-dom matchers available', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    document.body.appendChild(element);
    
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello World');
  });

  it('should have localStorage mocked', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');
  });
});

